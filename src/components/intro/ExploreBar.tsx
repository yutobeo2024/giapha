import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { FamilyMember } from "../../types";
import { isAlive } from "../../types";
import { parentLabel } from "../../lib/lineage";

/** Bỏ dấu tiếng Việt để tìm tên không cần gõ dấu */
export function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

interface Props {
  members: FamilyMember[];
  minGen: number;
  maxGen: number;
  activeGen: number | null;
  onPickMember: (m: FamilyMember) => void;
  onPickGen: (g: number | null) => void;
  onExit: () => void;
  /** Màn dọc: thanh chiếm hết bề ngang, chip cuộn ngang */
  compact: boolean;
}

/** Thanh công cụ chế độ Khám phá: về hành trình, tìm người, chọn đời, chú giải màu */
export default function ExploreBar({ members, minGen, maxGen, activeGen, onPickMember, onPickGen, onExit, compact }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const results = useMemo(() => {
    const nq = normalizeVi(q);
    if (!nq) return [];
    const scored = members
      .map((m) => {
        const n = normalizeVi(m.name);
        const idx = n.indexOf(nq);
        if (idx < 0) return null;
        // Khớp đầu từ xếp trước
        const wordStart = idx === 0 || n[idx - 1] === " ";
        return { m, score: (wordStart ? 0 : 1) * 100 + idx };
      })
      .filter((x): x is { m: FamilyMember; score: number } => !!x)
      .sort((a, b) => a.score - b.score || a.m.generation - b.m.generation || a.m.name.localeCompare(b.m.name, "vi"));
    return scored.slice(0, 8).map((x) => x.m);
  }, [members, q]);

  useEffect(() => {
    setOpen(results.length > 0);
  }, [results.length]);

  const gens: number[] = [];
  for (let g = minGen; g <= maxGen; g++) gens.push(g);

  const pick = (m: FamilyMember) => {
    onPickMember(m);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className={`intro-explore-bar ${compact ? "intro-explore-bar-compact" : ""}`} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <button onClick={onExit} className="intro-icon-btn shrink-0" aria-label="Về hành trình" title="Về hành trình">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="relative flex-1 min-w-0">
          <div className="intro-search">
            <Search className="w-4 h-4 text-[#f6c35b]/80 shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpen(results.length > 0)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) pick(results[0]);
                if (e.key === "Escape") {
                  setQ("");
                  inputRef.current?.blur();
                }
                e.stopPropagation();
              }}
              placeholder="Tìm người theo tên…"
              aria-label="Tìm người"
              autoComplete="off"
              className="bg-transparent outline-none flex-1 min-w-0 text-sm placeholder:text-[#f5ead6]/40"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-[#f5ead6]/60 hover:text-white" aria-label="Xóa">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {open && (
            <ul className="intro-suggest" role="listbox">
              {results.map((m) => (
                <li key={m.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)} className="intro-suggest-item">
                    <span className={`intro-dot ${isAlive(m) ? "intro-dot-alive" : ""}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif font-bold text-[#fff0c8] truncate">{m.name}</span>
                      {parentLabel(m, byId) && <span className="block text-[11px] text-[#f5ead6]/60 truncate">{parentLabel(m, byId)}</span>}
                    </span>
                    <span className="ml-auto text-[10px] tracking-[0.2em] uppercase text-[#f6c35b]/80 shrink-0">Đời {m.generation}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <GenChips gens={gens} activeGen={activeGen} onPickGen={onPickGen} />
      <div className="intro-legend mt-2">
        <span className="intro-dot" /> Tiền nhân
        <span className="intro-dot intro-dot-alive ml-2" /> Đang sống
        {compact && <span className="ml-auto text-[#f5ead6]/50">Kéo xoay · Chụm phóng · Chạm xem</span>}
      </div>
    </div>
  );
}

/**
 * Hàng chip chọn đời cuộn ngang: có nút mũi tên hai bên khi còn chip bị khuất,
 * lăn chuột dọc cũng cuộn ngang, chip đang chọn luôn được kéo vào khung nhìn.
 */
function GenChips({ gens, activeGen, onPickGen }: { gens: number[]; activeGen: number | null; onPickGen: (g: number | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gens.length]);

  useEffect(() => {
    if (activeGen == null) return;
    ref.current?.querySelector<HTMLElement>(`[data-gen="${activeGen}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeGen]);

  const page = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="intro-chips-wrap mt-2">
      {edge.left && (
        <button type="button" className="intro-chips-arrow intro-chips-arrow-left" onClick={() => page(-1)} aria-label="Các đời trước">
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div className="intro-chips" ref={ref} onScroll={update}>
        {gens.map((g) => (
          <button key={g} data-gen={g} onClick={() => onPickGen(activeGen === g ? null : g)} className={`intro-chip ${activeGen === g ? "intro-chip-active" : ""}`}>
            Đời {g}
          </button>
        ))}
      </div>
      {edge.right && (
        <button type="button" className="intro-chips-arrow intro-chips-arrow-right" onClick={() => page(1)} aria-label="Các đời sau">
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
