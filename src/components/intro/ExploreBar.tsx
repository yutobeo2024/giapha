import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import type { FamilyMember } from "../../types";
import { isAlive } from "../../types";

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
                    <span className="font-serif font-bold text-[#fff0c8] truncate">{m.name}</span>
                    <span className="ml-auto text-[10px] tracking-[0.2em] uppercase text-[#f6c35b]/80 shrink-0">Đời {m.generation}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 min-w-0">
        <div className="intro-chips">
          {gens.map((g) => (
            <button key={g} onClick={() => onPickGen(activeGen === g ? null : g)} className={`intro-chip ${activeGen === g ? "intro-chip-active" : ""}`}>
              Đời {g}
            </button>
          ))}
        </div>
        {!compact && (
          <div className="intro-legend shrink-0">
            <span className="intro-dot" /> Tiền nhân
            <span className="intro-dot intro-dot-alive ml-2" /> Đang sống
          </div>
        )}
      </div>
      {compact && (
        <div className="intro-legend mt-2">
          <span className="intro-dot" /> Tiền nhân
          <span className="intro-dot intro-dot-alive ml-2" /> Đang sống
          <span className="ml-auto text-[#f5ead6]/50">Kéo xoay · Chụm phóng · Chạm xem</span>
        </div>
      )}
    </div>
  );
}
