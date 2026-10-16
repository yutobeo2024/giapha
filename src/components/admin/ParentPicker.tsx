import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { FamilyMember } from "../../types";
import { foldText } from "../../lib/text";
import { descendantIds, parentLabel, type MemberIndex } from "../../lib/lineage";

interface Props {
  label: string;
  gender: FamilyMember["gender"];
  value?: string;
  members: FamilyMember[];
  index: MemberIndex;
  /** Người đang sửa: không được chọn chính mình hay con cháu mình làm cha mẹ */
  excludeId?: string;
  onChange: (id: string | undefined) => void;
}

const LIMIT = 12;

/** Chọn cha/mẹ bằng cách gõ tên (không cần dấu); mỗi kết quả kèm đời và tên ông nội để phân biệt người trùng tên */
const ParentPicker: React.FC<Props> = ({ label, gender, value, members, index, excludeId, onChange }) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = value ? index.byId.get(value) : undefined;

  const blocked = useMemo(() => {
    const set = excludeId ? descendantIds(excludeId, index.childrenOf) : new Set<string>();
    if (excludeId) set.add(excludeId);
    return set;
  }, [excludeId, index]);

  const results = useMemo(() => {
    const nq = foldText(q.trim());
    if (!nq) return [];
    return members
      .filter((m) => m.gender === gender && !blocked.has(m.id))
      .map((m) => {
        const n = foldText(m.name);
        const i = n.indexOf(nq);
        if (i < 0) return null;
        // Khớp đầu từ xếp trước, rồi tới đời thấp hơn
        return { m, score: (i === 0 || n[i - 1] === " " ? 0 : 100) + i };
      })
      .filter((x): x is { m: FamilyMember; score: number } => !!x)
      .sort((a, b) => a.score - b.score || a.m.generation - b.m.generation || a.m.name.localeCompare(b.m.name, "vi"))
      .slice(0, LIMIT)
      .map((x) => x.m);
  }, [members, gender, blocked, q]);

  const pick = (m: FamilyMember) => {
    onChange(m.id);
    setQ("");
    setOpen(false);
  };

  if (selected || value) {
    return (
      <div>
        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">{label}</label>
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl">
          <div className="min-w-0 flex-grow">
            <div className="font-bold text-[#2D2A26] truncate">{selected?.name ?? "(không còn trong danh sách)"}</div>
            {selected && (
              <div className="text-xs text-[#A19D96] truncate">
                Đời {selected.generation}
                {parentLabel(selected, index.byId) ? ` · ${parentLabel(selected, index.byId)}` : ""}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="p-1.5 rounded-lg text-[#6B665F] hover:text-[#8B2323] hover:bg-[#8B2323]/5 shrink-0"
            aria-label={`Bỏ chọn ${label.toLowerCase()}`}
            title="Bỏ chọn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">{label}</label>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A19D96] pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) pick(results[0]);
            }
            if (e.key === "Escape") setQ("");
          }}
          placeholder="Chưa rõ — gõ tên để tìm (không cần dấu)"
          aria-label={`Tìm ${label.toLowerCase()}`}
          autoComplete="off"
          className="w-full pl-11 pr-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
        />
      </div>
      {open && q.trim() && (
        <ul
          role="listbox"
          aria-label={`Kết quả tìm ${label.toLowerCase()}`}
          className="absolute left-0 right-0 top-full mt-2 z-20 max-h-64 overflow-y-auto bg-white border border-[#E5E1D8] rounded-2xl shadow-xl p-1.5"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#A19D96]">Không thấy ai tên như vậy.</li>
          ) : (
            results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(m)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#8B2323]/5"
                >
                  <div className="text-sm font-bold text-[#2D2A26]">{m.name}</div>
                  <div className="text-xs text-[#A19D96]">
                    Đời {m.generation}
                    {parentLabel(m, index.byId) ? ` · ${parentLabel(m, index.byId)}` : ""}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default ParentPicker;
