import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { doc, onSnapshot } from "firebase/firestore";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Music2, VolumeX, X, Network, Users, ArrowRight, Orbit, Compass, ArrowUpFromLine } from "lucide-react";
import { db } from "../firebase";
import { fetchMembers } from "../hooks/useMembers";
import type { FamilyMember } from "../types";
import { STATUS_LABEL, isAlive } from "../types";
import { computeTreeLayout } from "../lib/treeLayout3d";
import { INTRO_CHAPTERS, computeIntroStats } from "../data/introChapters";
import type { Quality, SceneMode, SpinState, FlyRequest } from "../components/intro/TreeScene";
import ExploreBar from "../components/intro/ExploreBar";

const TreeScene = lazy(() => import("../components/intro/TreeScene"));

const AUTO_ADVANCE_BASE_MS = 7000;

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const weakCpu = (nav.hardwareConcurrency || 8) <= 4;
  const lowMem = (nav.deviceMemory || 8) < 4;
  return small || weakCpu || lowMem ? "low" : "high";
}

function usePanelMode(): "left" | "bottom" {
  const get = () => (window.innerWidth >= 900 && window.innerWidth / window.innerHeight >= 1.05 ? "left" : "bottom");
  const [mode, setMode] = useState<"left" | "bottom">(get);
  useEffect(() => {
    const on = () => setMode(get());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return mode;
}

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

/** Phần tử tương tác: không bắt đầu kéo xoay từ đây */
const isInteractive = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("button, a, input, .intro-explore-bar, .intro-member-card");

/** Người xem đã tắt nhạc trong lần xem này (giữ tới khi đóng tab); lỗi lưu trữ thì coi như chưa tắt */
const MUSIC_OFF_KEY = "intro-music-off";
function musicOffThisVisit(): boolean {
  try {
    return sessionStorage.getItem(MUSIC_OFF_KEY) === "1";
  } catch {
    return false;
  }
}
function setMusicOffThisVisit(off: boolean) {
  try {
    if (off) sessionStorage.setItem(MUSIC_OFF_KEY, "1");
    else sessionStorage.removeItem(MUSIC_OFF_KEY);
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
}

const Intro: React.FC = () => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);

  const [chapterIdx, setChapterIdx] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [selected, setSelected] = useState<FamilyMember | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Chế độ Khám phá 3D
  const [mode, setMode] = useState<SceneMode>("story");
  const [fly, setFly] = useState<FlyRequest | null>(null);
  const [activeGen, setActiveGen] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const hintShown = useRef(false);
  const flySeq = useRef(0);
  const spin = useRef<SpinState>({ offset: 0, velocity: 0, dragging: false });

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [insets, setInsets] = useState({ top: 64, left: 0, bottom: 0 });
  const audioRef = useRef<HTMLAudioElement>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const webgl = useMemo(detectWebGL, []);
  const quality = useMemo(detectQuality, []);
  const reducedMotion = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);
  const panel = usePanelMode();

  // ---------- data
  useEffect(() => {
    let alive = true;
    fetchMembers().then(
      (m) => {
        if (!alive) return;
        setMembers(m);
        setLoading(false);
      },
      () => {
        if (!alive) return;
        setError("Không tải được danh sách thành viên. Vui lòng thử lại sau.");
        setLoading(false);
      }
    );
    const unsubSettings = onSnapshot(
      doc(db, "settings", "site"),
      (snap) => setMusicUrl((snap.data()?.introMusicUrl as string) || null),
      () => setMusicUrl(null)
    );
    return () => {
      alive = false;
      unsubSettings();
    };
  }, []);

  const layout = useMemo(() => computeTreeLayout(members), [members]);
  const stats = useMemo(() => computeIntroStats(members), [members]);
  const chapter = INTRO_CHAPTERS[chapterIdx];
  const highlightIds = useMemo(() => new Set((chapter.highlight || []).filter((id) => layout.byId.has(id))), [chapter, layout]);
  const body = typeof chapter.body === "function" ? chapter.body(stats, members) : chapter.body;
  const total = INTRO_CHAPTERS.length;
  const exploring = mode === "explore";

  // ---------- navigation
  const resetSpin = () => {
    spin.current.offset = 0;
    spin.current.velocity = 0;
  };
  const go = useCallback(
    (delta: number, loop = false) => {
      setSelected(null);
      resetSpin();
      setChapterIdx((i) => {
        const n = i + delta;
        if (loop) return (n + total) % total;
        return Math.max(0, Math.min(total - 1, n));
      });
    },
    [total]
  );

  const requestFly = useCallback((req: Omit<FlyRequest, "seq">) => {
    flySeq.current += 1;
    setFly({ seq: flySeq.current, ...req });
  }, []);

  const select = useCallback(
    (m: FamilyMember | null) => {
      setSelected(m);
      if (m && mode === "explore") {
        setActiveGen(null);
        requestFly({ id: m.id });
      }
    },
    [mode, requestFly]
  );

  const enterExplore = () => {
    setMode("explore");
    setSelected(null);
    setActiveGen(null);
    if (!hintShown.current) {
      hintShown.current = true;
      setHint(panel === "left" ? "Kéo chuột để xoay · Cuộn để phóng · Chuột phải để dời · Bấm vào người để xem" : "Kéo để xoay · Chụm hai ngón để phóng · Chạm vào người để xem");
      window.setTimeout(() => setHint(null), 4500);
    }
  };
  const exitExplore = () => {
    setMode("story");
    setActiveGen(null);
    setFly(null);
    setSelected(null);
    resetSpin();
  };

  // Cử chỉ ở chế độ hành trình: cuộn/vuốt dọc sang chương, kéo ngang xoay cây. Khám phá: OrbitControls tự xử lý.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (exploring) return;
    let acc = 0;
    let lock = 0;
    const onWheel = (e: WheelEvent) => {
      // Chỉ nhường cuộn cho khung chữ khi nó thật sự đang tràn (màn dọc, chữ dài)
      const sc = (e.target as HTMLElement).closest("[data-scrollable]") as HTMLElement | null;
      if (sc && sc.scrollHeight > sc.clientHeight + 4) return;
      e.preventDefault();
      const now = Date.now();
      if (now < lock) return;
      acc += e.deltaY;
      if (Math.abs(acc) > 60) {
        go(acc > 0 ? 1 : -1);
        acc = 0;
        lock = now + 900;
      }
    };

    const spinRate = () => (Math.PI * 2) / Math.max(320, window.innerHeight) * 0.9;
    // Chuột: kéo ngang xoay cây
    let mouseDown = false;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isInteractive(e.target)) return;
      mouseDown = true;
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      const dx = e.clientX - lastX;
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      lastX = e.clientX;
      lastT = now;
      if (Math.abs(dx) > 0) {
        spin.current.dragging = true;
        spin.current.offset += dx * spinRate();
        vel = (dx * spinRate()) / dt;
      }
    };
    const onMouseUp = () => {
      if (!mouseDown) return;
      mouseDown = false;
      if (spin.current.dragging) {
        spin.current.dragging = false;
        spin.current.velocity = Math.max(-6, Math.min(6, vel * 0.6));
      }
    };

    // Chạm: vuốt dọc nhanh sang chương; kéo ngang xoay cây
    let startY = 0;
    let startX = 0;
    let startT = 0;
    let touchLastX = 0;
    let touchLastT = 0;
    let touchVel = 0;
    let horizontal = false;
    let fromInteractive = false;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      touchLastX = startX;
      startT = Date.now();
      touchLastT = performance.now();
      touchVel = 0;
      horizontal = false;
      fromInteractive = isInteractive(e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (fromInteractive || e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (!horizontal) {
        const dx = x - startX;
        const dy = y - startY;
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          horizontal = true;
          spin.current.dragging = true;
        }
      }
      if (horizontal) {
        const dx = x - touchLastX;
        const now = performance.now();
        const dt = Math.max(1, now - touchLastT) / 1000;
        touchLastX = x;
        touchLastT = now;
        spin.current.offset += dx * spinRate();
        touchVel = (dx * spinRate()) / dt;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (horizontal) {
        horizontal = false;
        spin.current.dragging = false;
        spin.current.velocity = Math.max(-6, Math.min(6, touchVel * 0.6));
        return;
      }
      const dy = startY - e.changedTouches[0].clientY;
      const dx = startX - e.changedTouches[0].clientX;
      if (Date.now() - startT > 1000) return;
      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.2) go(dy > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      spin.current.dragging = false;
    };
  }, [go, exploring]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else if (presenting) stopPresenting();
        else if (exploring) exitExplore();
        return;
      }
      if (exploring) return;
      if (["ArrowDown", "PageDown", " ", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowUp", "PageUp", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- presentation
  const startPresenting = async () => {
    if (exploring) exitExplore();
    setPresenting(true);
    setSelected(null);
    setChapterIdx(0);
    resetSpin();
    const el = rootRef.current as FsElement | null;
    try {
      if (el?.requestFullscreen) await el.requestFullscreen();
      else if (el?.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {
      /* iPhone Safari không hỗ trợ: trang vẫn phủ kín màn hình bằng CSS */
    }
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLock.current = null;
    }
    if (musicUrl && audioRef.current && !musicOffThisVisit()) {
      audioRef.current.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
  };

  function stopPresenting() {
    setPresenting(false);
    const d = document as FsDocument;
    if (d.fullscreenElement) d.exitFullscreen?.().catch(() => undefined);
    else if (d.webkitFullscreenElement) d.webkitExitFullscreen?.();
    wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }

  useEffect(() => {
    const onFs = () => {
      const d = document as FsDocument;
      if (!d.fullscreenElement && !d.webkitFullscreenElement && presenting) {
        // Người dùng thoát toàn màn hình bằng Esc của trình duyệt
        setPresenting(false);
        wakeLock.current?.release().catch(() => undefined);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, [presenting]);

  // Tự chuyển chương khi trình chiếu (đọc lâu hơn với đoạn dài)
  useEffect(() => {
    if (!presenting) return;
    const ms = AUTO_ADVANCE_BASE_MS + body.length * 35;
    const t = window.setTimeout(() => go(1, true), ms);
    return () => window.clearTimeout(t);
  }, [presenting, chapterIdx, body.length, go]);

  // Ẩn nút điều khiển khi trình chiếu và không động chạm
  useEffect(() => {
    if (!presenting) {
      setControlsVisible(true);
      return;
    }
    let t = window.setTimeout(() => setControlsVisible(false), 3000);
    const show = () => {
      setControlsVisible(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setControlsVisible(false), 3000);
    };
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousemove", show);
      window.removeEventListener("touchstart", show);
    };
  }, [presenting]);

  // ---------- music
  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (musicOn) {
      a.pause();
      setMusicOn(false);
      setMusicOffThisVisit(true);
    } else {
      setMusicOffThisVisit(false);
      a.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
  };
  useEffect(() => {
    if (!musicUrl) setMusicOn(false);
  }, [musicUrl]);

  // Vào trang là phát nhạc, trừ khi người xem đã tắt trong lần xem này. Trình duyệt chặn phát
  // tiếng khi trang chưa được chạm (mở thẳng link): khi đó phát ở lần chạm/cuộn/bấm phím đầu tiên.
  useEffect(() => {
    const a = audioRef.current;
    if (!musicUrl || !a || musicOffThisVisit()) return;
    let done = false;
    const events = ["pointerdown", "keydown", "touchend", "wheel"] as const;
    const detach = () => events.forEach((ev) => window.removeEventListener(ev, onGesture, true));
    const start = () =>
      a.play().then(
        () => {
          done = true;
          setMusicOn(true);
          detach();
        },
        () => setMusicOn(false)
      );
    function onGesture(e: Event) {
      // Bấm thẳng vào nút nhạc thì để toggleMusic xử lý, tránh bật rồi tắt ngay
      if ((e.target as Element | null)?.closest?.("[data-music-toggle]")) return detach();
      if (!done && !musicOffThisVisit()) start();
    }
    events.forEach((ev) => window.addEventListener(ev, onGesture, true));
    start();
    return detach;
  }, [musicUrl]);

  // Đo khung chữ để camera đặt cây vào đúng phần màn hình còn trống (mọi thiết bị)
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const top = presenting ? 16 : 64;
      if (panel === "left") setInsets({ top, left: Math.round(r.right + 24), bottom: 0 });
      else setInsets({ top: top + 44, left: 0, bottom: Math.round(window.innerHeight - r.top + 12) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [panel, presenting, chapterIdx, exploring]);

  // ---------- render helpers
  const panelClass =
    panel === "left"
      ? "absolute z-[35] left-6 lg:left-12 top-1/2 -translate-y-1/2 w-[min(460px,40vw)]"
      : "absolute z-[35] inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]";
  const parentOfSelected = selected ? members.find((m) => m.id === selected.fatherId) || members.find((m) => m.id === selected.motherId) : undefined;

  if (!webgl) return <StaticIntro members={members} />;

  return (
    <div
      ref={rootRef}
      className={`intro-root fixed inset-0 overflow-hidden bg-[#0b0a12] text-[#f5ead6] select-none ${presenting ? "z-[100]" : "z-0"}`}
    >
      {/* 3D */}
      <div className="absolute inset-0">
        {!loading && members.length > 0 && (
          <Suspense fallback={<LoadingSeal text="Đang dựng cây gia phả…" />}>
            <TreeScene
              layout={layout}
              chapter={chapter}
              highlightIds={highlightIds}
              quality={quality}
              reducedMotion={reducedMotion}
              insets={insets}
              selectedId={selected?.id ?? null}
              onSelect={select}
              mode={mode}
              spin={spin}
              fly={fly}
              activeGen={activeGen}
              onInteract={() => undefined}
            />
          </Suspense>
        )}
        {loading && <LoadingSeal text="Đang tải dữ liệu dòng họ…" />}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-200">{error}</div>
        )}
      </div>

      {/* Chữ chương (hành trình) */}
      {!exploring && (
        <div ref={panelRef} className={`${panelClass} pointer-events-none`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={chapter.id}
              initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`intro-card pointer-events-auto ${panel === "bottom" ? "intro-card-bottom" : ""}`}
              data-scrollable
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="intro-kicker">{chapter.kicker}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-[#f6c35b]/50 to-transparent" />
                <span className="text-[11px] tracking-[0.25em] text-[#f6c35b]/70 tabular-nums">
                  {String(chapterIdx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                </span>
              </div>
              <h1 className="intro-title">{chapter.title}</h1>
              <p className="intro-body">{body}</p>

              {chapter.id === "sum-sue" && stats.totalMembers > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-5">
                  {[
                    { v: stats.generations, l: "Thế hệ" },
                    { v: stats.totalMembers, l: "Thành viên" },
                    { v: stats.alive, l: "Còn sống" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-[#f6c35b]/25 bg-black/20 px-3 py-2 text-center">
                      <div className="font-serif text-2xl sm:text-3xl text-[#ffe7a8]">{s.v}</div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#f5ead6]/60">{s.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {chapter.cta && !presenting && (
                <div className="flex flex-wrap gap-2 mt-6">
                  <button onClick={enterExplore} className="intro-btn intro-btn-primary">
                    <Orbit className="w-4 h-4" /> Khám phá cây 3D
                  </button>
                  <Link to="/tree" className="intro-btn">
                    <Network className="w-4 h-4" /> Cây gia phả
                  </Link>
                  <Link to="/members" className="intro-btn">
                    <Users className="w-4 h-4" /> Danh sách
                  </Link>
                </div>
              )}

              {chapterIdx === 0 && !presenting && (
                <div className="mt-6 space-y-2 text-xs text-[#f5ead6]/55">
                  <div className="intro-legend">
                    <span className="intro-dot" /> Tiền nhân
                    <span className="intro-dot intro-dot-alive ml-2" /> Đang sống
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 animate-bounce shrink-0" />
                    {panel === "left" ? "Cuộn chuột để tiếp tục · Kéo ngang để xoay cây" : "Vuốt lên để tiếp tục · Kéo ngang để xoay cây · Chạm ánh sáng để xem tên"}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Thanh Khám phá */}
      {exploring && (
        <ExploreBar
          members={members}
          minGen={layout.minGen}
          maxGen={layout.maxGen}
          activeGen={activeGen}
          onPickMember={(m) => select(m)}
          onPickGen={(g) => {
            setActiveGen(g);
            setSelected(null);
            if (g != null) requestFly({ gen: g });
          }}
          onExit={exitExplore}
          compact={panel === "bottom"}
        />
      )}
      <AnimatePresence>
        {hint && exploring && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="intro-hint">
            {hint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chấm chương */}
      {!exploring && (
        <div
          className={`absolute z-[40] transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0"} ${
            panel === "left"
              ? "right-5 top-1/2 -translate-y-1/2 flex flex-col gap-3"
              : `left-4 flex gap-2.5 items-center h-10 ${presenting ? "top-4" : "top-[5rem]"}`
          }`}
        >
          {INTRO_CHAPTERS.map((c, i) => (
            <button
              key={c.id}
              onClick={() => {
                setSelected(null);
                resetSpin();
                setChapterIdx(i);
              }}
              aria-label={c.title}
              title={c.title}
              className={`rounded-full transition-all ${
                i === chapterIdx ? "bg-[#f6c35b] shadow-[0_0_12px_#f6c35b] w-2.5 h-2.5 scale-125" : "bg-white/30 hover:bg-white/60 w-2.5 h-2.5"
              }`}
            />
          ))}
        </div>
      )}

      {/* Nút điều khiển */}
      <div
        className={`absolute z-[40] right-4 sm:right-6 flex items-center gap-2 transition-opacity duration-500 ${
          presenting ? "top-4" : "top-[5rem]"
        } ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"} ${exploring && panel === "bottom" ? "hidden" : ""}`}
      >
        {musicUrl && (
          <button onClick={toggleMusic} data-music-toggle className="intro-icon-btn" aria-label={musicOn ? "Tắt nhạc" : "Bật nhạc"} title={musicOn ? "Tắt nhạc" : "Bật nhạc"}>
            {musicOn ? <Music2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}
        {presenting ? (
          <button onClick={stopPresenting} className="intro-btn">
            <Minimize2 className="w-4 h-4" /> Thoát
          </button>
        ) : exploring ? (
          <button onClick={exitExplore} className="intro-btn">
            <Compass className="w-4 h-4" /> Về hành trình
          </button>
        ) : (
          <>
            <button onClick={enterExplore} className="intro-btn" title="Xoay, phóng và đi tới từng người trên cây">
              <Orbit className="w-4 h-4" /> <span className="hidden sm:inline">Khám phá 3D</span>
              <span className="sm:hidden">3D</span>
            </button>
            <button onClick={startPresenting} className="intro-btn intro-btn-primary">
              <Maximize2 className="w-4 h-4" /> Trình chiếu
            </button>
          </>
        )}
      </div>

      {/* Trước / sau cho màn dọc */}
      {panel === "bottom" && controlsVisible && !exploring && (
        <div className="absolute z-[40] right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          <button onClick={() => go(-1)} disabled={chapterIdx === 0} className="intro-icon-btn disabled:opacity-30" aria-label="Chương trước">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button onClick={() => go(1)} disabled={chapterIdx === total - 1} className="intro-icon-btn disabled:opacity-30" aria-label="Chương sau">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Thẻ người được chọn */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`absolute intro-card intro-member-card ${
              panel === "left" ? "right-14 bottom-8 w-[320px]" : `left-4 right-4 sm:left-auto sm:w-[360px] ${exploring ? "bottom-[max(1rem,env(safe-area-inset-bottom))]" : "top-[8.5rem]"}`
            }`}
          >
            <button onClick={() => setSelected(null)} className="absolute right-3 top-3 text-[#f5ead6]/60 hover:text-white" aria-label="Đóng">
              <X className="w-4 h-4" />
            </button>
            <div className="intro-kicker mb-1 flex items-center gap-2">
              <span className={`intro-dot ${isAlive(selected) ? "intro-dot-alive" : ""}`} /> Đời thứ {selected.generation}
            </div>
            <div className="font-serif text-2xl text-[#ffe7a8] pr-6">{selected.name}</div>
            <div className="text-xs text-[#f5ead6]/60 mt-1">
              {selected.gender} · {STATUS_LABEL[selected.status || "Deceased"]}
              {selected.spouse ? ` · Phối ngẫu: ${selected.spouse}` : ""}
            </div>
            {selected.biography && <p className="text-sm text-[#f5ead6]/85 mt-3 leading-relaxed line-clamp-4">{selected.biography}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
              {exploring && parentOfSelected && (
                <button onClick={() => select(parentOfSelected)} className="inline-flex items-center gap-1.5 text-[#f6c35b] hover:underline">
                  <ArrowUpFromLine className="w-3.5 h-3.5" /> Bay tới {parentOfSelected.gender === "Nữ" ? "mẹ" : "cha"}: {parentOfSelected.name}
                </button>
              )}
              {!presenting && (
                <Link to={`/tree?highlight=${selected.id}`} className="inline-flex items-center gap-1.5 text-[#f6c35b] hover:underline">
                  Xem trên cây gia phả <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {musicUrl && <audio ref={audioRef} src={musicUrl} loop preload="auto" onEnded={() => setMusicOn(false)} />}
    </div>
  );
};

function LoadingSeal({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
      <div className="w-20 h-20 rounded-full border border-[#f6c35b]/50 flex items-center justify-center font-serif text-4xl text-[#ffe7a8] animate-pulse shadow-[0_0_40px_rgba(246,195,91,0.35)]">
        阮
      </div>
      <div className="text-sm tracking-wide text-[#f5ead6]/70">{text}</div>
    </div>
  );
}

/** Bản tĩnh cho thiết bị không hỗ trợ WebGL */
function StaticIntro({ members }: { members: FamilyMember[] }) {
  const stats = computeIntroStats(members);
  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-[#070b1c] via-[#120c1d] to-[#2b0b10] text-[#f5ead6] pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {INTRO_CHAPTERS.map((c) => (
          <div key={c.id} className="intro-card">
            <div className="intro-kicker mb-2">{c.kicker}</div>
            <h2 className="intro-title !text-3xl">{c.title}</h2>
            <p className="intro-body">{typeof c.body === "function" ? c.body(stats, members) : c.body}</p>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Link to="/tree" className="intro-btn intro-btn-primary">
            <Network className="w-4 h-4" /> Khám phá Cây gia phả
          </Link>
          <Link to="/members" className="intro-btn">
            <Users className="w-4 h-4" /> Xem danh sách
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Intro;
