import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Music2, VolumeX, X, Network, Users, ArrowRight } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import type { FamilyMember } from "../types";
import { STATUS_LABEL } from "../types";
import { computeTreeLayout } from "../lib/treeLayout3d";
import { INTRO_CHAPTERS, computeIntroStats } from "../data/introChapters";
import type { Quality } from "../components/intro/TreeScene";

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
    const unsub = onSnapshot(
      query(collection(db, "members"), orderBy("generation", "asc"), orderBy("name", "asc")),
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember));
        setLoading(false);
      },
      (err) => {
        setError(handleFirestoreError(err, OperationType.LIST, "members"));
        setLoading(false);
      }
    );
    const unsubSettings = onSnapshot(
      doc(db, "settings", "site"),
      (snap) => setMusicUrl((snap.data()?.introMusicUrl as string) || null),
      () => setMusicUrl(null)
    );
    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  const layout = useMemo(() => computeTreeLayout(members), [members]);
  const stats = useMemo(() => computeIntroStats(members), [members]);
  const chapter = INTRO_CHAPTERS[chapterIdx];
  const highlightIds = useMemo(() => new Set((chapter.highlight || []).filter((id) => layout.byId.has(id))), [chapter, layout]);
  const body = typeof chapter.body === "function" ? chapter.body(stats, members) : chapter.body;
  const total = INTRO_CHAPTERS.length;

  // ---------- navigation
  const go = useCallback(
    (delta: number, loop = false) => {
      setSelected(null);
      setChapterIdx((i) => {
        const n = i + delta;
        if (loop) return (n + total) % total;
        return Math.max(0, Math.min(total - 1, n));
      });
    },
    [total]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
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
    let startY = 0;
    let startX = 0;
    let startT = 0;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startT = Date.now();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dy = startY - e.changedTouches[0].clientY;
      const dx = startX - e.changedTouches[0].clientX;
      if (Date.now() - startT > 800) return;
      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.2) go(dy > 0 ? 1 : -1);
      else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowUp", "PageUp", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        if (selected) setSelected(null);
        else if (presenting) stopPresenting();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- presentation
  const startPresenting = async () => {
    setPresenting(true);
    setSelected(null);
    setChapterIdx(0);
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
    if (musicUrl && audioRef.current) {
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
    } else {
      a.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
  };
  useEffect(() => {
    if (!musicUrl) setMusicOn(false);
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
  }, [panel, presenting, chapterIdx]);

  // ---------- render helpers
  const panelClass =
    panel === "left"
      ? "absolute left-6 lg:left-12 top-1/2 -translate-y-1/2 w-[min(460px,40vw)]"
      : "absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]";

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
              onSelect={setSelected}
            />
          </Suspense>
        )}
        {loading && <LoadingSeal text="Đang tải dữ liệu dòng họ…" />}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-200">{error}</div>
        )}
      </div>

      {/* Chữ chương */}
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
                <Link to="/tree" className="intro-btn intro-btn-primary">
                  <Network className="w-4 h-4" /> Khám phá Cây gia phả
                </Link>
                <Link to="/members" className="intro-btn">
                  <Users className="w-4 h-4" /> Xem danh sách
                </Link>
              </div>
            )}

            {chapterIdx === 0 && !presenting && (
              <div className="mt-6 flex items-center gap-2 text-xs text-[#f5ead6]/55">
                <ChevronDown className="w-4 h-4 animate-bounce" />
                {panel === "left" ? "Cuộn chuột hoặc dùng phím mũi tên để tiếp tục" : "Vuốt lên để tiếp tục, chạm vào đốm sáng để xem tên"}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chấm chương */}
      <div
        className={`absolute transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0"} ${
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

      {/* Nút điều khiển */}
      <div
        className={`absolute right-4 sm:right-6 flex items-center gap-2 transition-opacity duration-500 ${
          presenting ? "top-4" : "top-[5rem]"
        } ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {musicUrl && (
          <button onClick={toggleMusic} className="intro-icon-btn" aria-label={musicOn ? "Tắt nhạc" : "Bật nhạc"} title={musicOn ? "Tắt nhạc" : "Bật nhạc"}>
            {musicOn ? <Music2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}
        {presenting ? (
          <button onClick={stopPresenting} className="intro-btn">
            <Minimize2 className="w-4 h-4" /> Thoát
          </button>
        ) : (
          <button onClick={startPresenting} className="intro-btn intro-btn-primary">
            <Maximize2 className="w-4 h-4" /> Trình chiếu
          </button>
        )}
      </div>

      {/* Trước / sau cho màn dọc */}
      {panel === "bottom" && controlsVisible && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
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
              panel === "left" ? "right-14 bottom-8 w-[320px]" : "left-4 right-4 sm:left-auto sm:w-[360px] top-[8.5rem]"
            }`}
          >
            <button onClick={() => setSelected(null)} className="absolute right-3 top-3 text-[#f5ead6]/60 hover:text-white" aria-label="Đóng">
              <X className="w-4 h-4" />
            </button>
            <div className="intro-kicker mb-1">Đời thứ {selected.generation}</div>
            <div className="font-serif text-2xl text-[#ffe7a8] pr-6">{selected.name}</div>
            <div className="text-xs text-[#f5ead6]/60 mt-1">
              {selected.gender} · {STATUS_LABEL[selected.status || "Deceased"]}
              {selected.spouse ? ` · Phối ngẫu: ${selected.spouse}` : ""}
            </div>
            {selected.biography && <p className="text-sm text-[#f5ead6]/85 mt-3 leading-relaxed line-clamp-4">{selected.biography}</p>}
            {!presenting && (
              <Link to={`/tree?highlight=${selected.id}`} className="inline-flex items-center gap-1.5 mt-4 text-sm text-[#f6c35b] hover:underline">
                Xem trên cây gia phả <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {musicUrl && <audio ref={audioRef} src={musicUrl} loop preload="none" onEnded={() => setMusicOn(false)} />}
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
