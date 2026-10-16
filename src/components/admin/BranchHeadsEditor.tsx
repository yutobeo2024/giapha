import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Landmark, Plus, Save, Trash2 } from "lucide-react";
import { handleFirestoreError, OperationType } from "../../firebase";
import { fetchBranchHeads, saveBranchHeads, type BranchHead } from "../../lib/branchHeads";

type Message = { type: "success" | "error"; text: string };

interface Props {
  setMessage: (m: Message | null) => void;
  logActivity: (action: string) => Promise<void>;
}

const cellCls =
  "w-full min-w-0 px-3 py-2 bg-[#FDFCF9] border border-[#E5E1D8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20";
const iconBtn =
  "p-2 rounded-lg text-[#6B665F] hover:bg-[#8B2323]/5 hover:text-[#8B2323] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6B665F] transition-colors";

/** Quản trị → Cài đặt: sửa Bảng chi trưởng các địa phương hiện ở trang chủ */
const BranchHeadsEditor: React.FC<Props> = ({ setMessage, logActivity }) => {
  const [rows, setRows] = useState<BranchHead[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchBranchHeads()
      .then(setRows)
      .catch((err) => setMessage({ type: "error", text: handleFirestoreError(err, OperationType.GET, "settings") }));
  }, [setMessage]);

  const update = (next: BranchHead[]) => {
    setRows(next);
    setDirty(true);
  };
  const patch = (i: number, p: Partial<BranchHead>) => update(rows!.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows!];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    update(next);
  };

  const save = async () => {
    if (!rows) return;
    if (rows.some((r) => !r.name.trim() && r.address.trim())) {
      setMessage({ type: "error", text: "Có dòng có địa chỉ nhưng chưa có tên trưởng chi." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      setRows(await saveBranchHeads(rows));
      setDirty(false);
      await logActivity("đã cập nhật bảng chi trưởng các địa phương");
      setMessage({ type: "success", text: "Đã lưu bảng chi trưởng." });
    } catch (err) {
      setMessage({ type: "error", text: handleFirestoreError(err, OperationType.UPDATE, "settings") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-sm p-4 sm:p-8 space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FDFCF9] border border-[#E5E1D8] flex items-center justify-center text-[#8B2323] shrink-0">
          <Landmark className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-serif text-xl font-bold">Bảng chi trưởng các địa phương</h3>
          <p className="text-sm text-[#6B665F] mt-1">
            Hiện ở{" "}
            <a href="/" className="text-[#8B2323] font-semibold hover:underline">
              trang chủ
            </a>
            , phía trên Hoạt động gần đây. Thứ tự dòng là số TT; dùng mũi tên để đổi chỗ.
          </p>
        </div>
      </div>

      {!rows ? (
        <div className="h-24 rounded-2xl bg-[#FDFCF9] animate-pulse" />
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="p-3 rounded-2xl border border-[#E5E1D8] bg-white">
              {/* Điện thoại: ô nhập chiếm hết bề ngang, số TT và nút xuống hàng dưới; máy tính: một hàng */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="hidden sm:block w-7 shrink-0 text-center text-sm font-bold text-[#A19D96] tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0 grid grid-cols-[1fr_4rem] sm:grid-cols-[1fr_4.5rem_1.4fr] gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    placeholder="Tên trưởng chi"
                    aria-label={`Tên trưởng chi dòng ${i + 1}`}
                    className={cellCls}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={r.generation ?? ""}
                    onChange={(e) => patch(i, { generation: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="Đời"
                    aria-label={`Đời dòng ${i + 1}`}
                    className={cellCls}
                  />
                  <input
                    value={r.address}
                    onChange={(e) => patch(i, { address: e.target.value })}
                    placeholder="Địa chỉ - nhà thờ"
                    aria-label={`Địa chỉ dòng ${i + 1}`}
                    className={cellCls + " col-span-2 sm:col-span-1"}
                  />
                </div>
                <div className="flex items-center justify-between shrink-0">
                  <span className="sm:hidden pl-1 text-xs font-bold text-[#A19D96] tabular-nums">TT {i + 1}</span>
                  <div className="flex">
                    <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Lên trên">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" className={iconBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Xuống dưới">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={iconBtn + " hover:!text-red-600"}
                      onClick={() => update(rows.filter((_, j) => j !== i))}
                      title="Xóa dòng"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!rows}
          onClick={() => update([...(rows || []), { name: "", address: "" }])}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border border-[#E5E1D8] text-[#6B665F] hover:text-[#8B2323] disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Thêm dòng
        </button>
        <button
          type="button"
          disabled={!rows || !dirty || saving}
          onClick={save}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#8B2323] text-white hover:bg-[#6B1B1B] disabled:opacity-50 disabled:hover:bg-[#8B2323]"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Đang lưu..." : dirty ? "Lưu bảng" : "Đã lưu"}
        </button>
      </div>
    </div>
  );
};

export default BranchHeadsEditor;
