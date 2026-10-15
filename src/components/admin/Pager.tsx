import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const btnCls =
  "min-w-9 h-9 px-2 rounded-lg border border-[#E5E1D8] bg-white text-sm font-bold text-[#6B665F] hover:bg-[#8B2323]/5 hover:text-[#8B2323] disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#6B665F] transition-colors";

/** Số trang hiện trên thanh: trang đầu, trang cuối, quanh trang hiện tại; chỗ cách quãng thay bằng "…" */
function pageItems(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const nums = [...new Set([1, count, page - 1, page, page + 1])].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

const fmt = (n: number) => n.toLocaleString("vi-VN");

/** Thanh chuyển trang cho bảng dài: "Hiển thị 51–100 trong 1.576" và các nút ‹ 1 … 5 [6] 7 … 32 › */
export default function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-[#E5E1D8] bg-[#FDFCF9] text-sm">
      <span className="text-[#6B665F]">
        Hiển thị {fmt(from)}–{fmt(to)} trong {fmt(total)}
      </span>
      {pageCount > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Phân trang">
          <button type="button" className={btnCls} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageItems(page, pageCount).map((it, i) =>
            it === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-[#A19D96]">
                …
              </span>
            ) : (
              <button
                key={it}
                type="button"
                onClick={() => onChange(it)}
                aria-current={it === page ? "page" : undefined}
                className={`${btnCls} ${it === page ? "!bg-[#8B2323] !text-white !border-[#8B2323]" : ""}`}
              >
                {it}
              </button>
            )
          )}
          <button type="button" className={btnCls} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Trang sau">
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
