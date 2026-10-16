import React, { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { fetchBranchHeads, type BranchHead } from "../lib/branchHeads";

/** Bảng chi trưởng các địa phương ở trang chủ (admin sửa ở Quản trị → Cài đặt) */
const BranchHeadsTable: React.FC = () => {
  const [rows, setRows] = useState<BranchHead[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchBranchHeads()
      .then((r) => alive && setRows(r))
      .catch((err) => {
        console.error("Không đọc được bảng chi trưởng:", err);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-[#8B2323] rounded-full" />
        <h3 className="font-serif text-2xl font-bold text-[#2D2A26]">Chi Trưởng Các Địa Phương</h3>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5E1D8] overflow-hidden">
        {failed ? (
          <p className="p-6 text-sm text-[#A19D96] text-center">Chưa tải được bảng, vui lòng thử lại sau.</p>
        ) : !rows ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 bg-[#F3F0EA] rounded animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <Landmark className="w-10 h-10 text-[#A19D96] opacity-30 mx-auto mb-3" />
            <p className="text-sm text-[#A19D96]">Chưa có dữ liệu chi trưởng.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FDFCF9] border-b border-[#E5E1D8] text-[10px] font-bold uppercase tracking-widest text-[#A19D96]">
                <th className="pl-4 pr-2 sm:pl-6 py-3 text-center w-10">TT</th>
                <th className="px-2 py-3 text-left">Tên trưởng chi</th>
                <th className="px-2 py-3 text-center w-12">Đời</th>
                <th className="pl-2 pr-4 sm:pr-6 py-3 text-left">Địa chỉ - Nhà thờ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0ECE4]">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-[#FDFCF9] transition-colors align-top">
                  <td className="pl-4 pr-2 sm:pl-6 py-3 text-center text-[#A19D96] tabular-nums">{i + 1}</td>
                  <td className="px-2 py-3 font-bold text-[#2D2A26]">{r.name}</td>
                  <td className="px-2 py-3 text-center text-[#8B2323] font-bold tabular-nums">{r.generation ?? ""}</td>
                  <td className="pl-2 pr-4 sm:pr-6 py-3 text-[#6B665F]">{r.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default BranchHeadsTable;
