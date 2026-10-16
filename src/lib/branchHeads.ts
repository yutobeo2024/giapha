import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/** Một dòng của Bảng chi trưởng các địa phương */
export interface BranchHead {
  name: string;
  generation?: number;
  /** Địa chỉ - nhà thờ */
  address: string;
}

/** Lưu cả bảng trong một document (đọc 1 lượt), chỉ admin ghi theo luật settings/* */
const ref = () => doc(db, "settings", "branchHeads");

/** Bảng gốc theo "Bảng xem đời ông tổ của các chi và các chi trưởng ở các địa phương" (bỏ cột ông tổ) */
export const DEFAULT_BRANCH_HEADS: BranchHead[] = [
  { name: "Nguyễn Nhuận Thông", generation: 15, address: "Xóm Yên Thịnh, xã Phúc Thành" },
  { name: "Nguyễn Nhuận Niệm", generation: 15, address: "Xóm Xuân Viên, xã Phúc Thành" },
  { name: "Nguyễn Đình Hoàng", generation: 14, address: "xã Đức Thành" },
  { name: "Nguyễn Nhuận Niệm", generation: 15, address: "Xóm Xuân Viên, xã Phúc Thành" },
  { name: "Nguyễn Nhuận Long (Trinh)", generation: 17, address: "Xóm Hồng Phong, xã Phúc Thành" },
  { name: "Nguyễn Nhuận Hưng", generation: 16, address: "xã Văn Thành" },
  { name: "Ông Long (Trọng)", generation: 18, address: "Xóm Hồng Phong, xã Phúc Thành" },
  { name: "Nguyễn Trọng Hùng", generation: 17, address: "xã Hậu Thành" },
  { name: "Nguyễn Quang Nha", generation: 19, address: "Xã Quỳnh Đôi, huyện Quỳnh Lưu" },
  { name: "Nguyễn Nhuận Tình", generation: 17, address: "Xóm Hồng Phong, xã Phúc Thành" },
  { name: "Nguyễn Nhuận Vinh", generation: 17, address: "Xóm Xuân Viên, xã Phúc Thành" },
];

/** Chuẩn hóa trước khi lưu: bỏ dòng trống, cắt khoảng trắng, đời không hợp lệ thì bỏ trống */
export function normalizeBranchHeads(rows: BranchHead[]): BranchHead[] {
  return rows
    .map((r) => {
      const name = (r.name || "").trim();
      const address = (r.address || "").trim();
      const gen = Number(r.generation);
      return { name, address, ...(Number.isInteger(gen) && gen > 0 ? { generation: gen } : {}) };
    })
    .filter((r) => r.name || r.address);
}

/** Đọc bảng; chưa từng lưu thì dùng bảng gốc */
export async function fetchBranchHeads(): Promise<BranchHead[]> {
  const snap = await getDoc(ref());
  const rows = snap.exists() ? snap.data().rows : null;
  return Array.isArray(rows) ? (rows as BranchHead[]) : DEFAULT_BRANCH_HEADS;
}

export async function saveBranchHeads(rows: BranchHead[]): Promise<BranchHead[]> {
  const clean = normalizeBranchHeads(rows);
  await setDoc(ref(), { rows: clean, updatedAt: new Date().toISOString() });
  return clean;
}
