/**
 * Phả hệ: tra cha con, đếm con cháu, suy ra đời từ cha và kiểm tra trước khi lưu.
 * Quy ước: Thủy tổ là đời 1, đời con = đời cha + 1 (giống kỷ yếu 2023).
 */
import type { FamilyMember } from "../types";

export interface MemberIndex {
  byId: Map<string, FamilyMember>;
  childrenOf: Map<string, FamilyMember[]>;
}

export function indexMembers(members: FamilyMember[]): MemberIndex {
  const byId = new Map(members.map((m) => [m.id, m]));
  const childrenOf = new Map<string, FamilyMember[]>();
  for (const m of members) {
    for (const p of [m.fatherId, m.motherId]) {
      if (!p) continue;
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p)!.push(m);
    }
  }
  return { byId, childrenOf };
}

/** "con ông Nguyễn Văn A" để phân biệt người trùng tên; không rõ cha mẹ thì chuỗi rỗng */
export function parentLabel(m: Pick<FamilyMember, "fatherId" | "motherId">, byId: Map<string, FamilyMember>): string {
  const father = m.fatherId ? byId.get(m.fatherId) : undefined;
  if (father) return `con ông ${father.name}`;
  const mother = m.motherId ? byId.get(m.motherId) : undefined;
  if (mother) return `con bà ${mother.name}`;
  return "";
}

/** Tập id con cháu của một người (không gồm chính người đó); dữ liệu có vòng lặp cũng không treo */
export function descendantIds(id: string, childrenOf: Map<string, FamilyMember[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(childrenOf.get(id) || [])];
  while (stack.length) {
    const c = stack.pop()!;
    if (c.id === id || seen.has(c.id)) continue;
    seen.add(c.id);
    stack.push(...(childrenOf.get(c.id) || []));
  }
  return seen;
}

export const countDescendants = (id: string, childrenOf: Map<string, FamilyMember[]>): number => descendantIds(id, childrenOf).size;

/** Đời suy ra từ cha (không có cha thì từ mẹ); không rõ cả hai thì null, phải chọn tay */
export function derivedGeneration(form: Pick<FamilyMember, "fatherId" | "motherId">, byId: Map<string, FamilyMember>): number | null {
  const father = form.fatherId ? byId.get(form.fatherId) : undefined;
  if (father) return father.generation + 1;
  const mother = form.motherId ? byId.get(form.motherId) : undefined;
  return mother ? mother.generation + 1 : null;
}

type LineageForm = Pick<FamilyMember, "generation" | "fatherId" | "motherId">;

/**
 * Lỗi phả hệ trước khi lưu, null nếu hợp lệ: cha/mẹ phải có thật, không phải chính mình hay con cháu mình,
 * đời phải bằng đời cha mẹ + 1; người đã có con cháu thì không được đổi đời (phải sửa từ cha xuống).
 */
export function lineageError(form: LineageForm, original: FamilyMember | null, index: MemberIndex): string | null {
  const below = original ? descendantIds(original.id, index.childrenOf) : new Set<string>();
  for (const [key, role] of [
    ["fatherId", "cha"],
    ["motherId", "mẹ"],
  ] as const) {
    const pid = form[key];
    if (!pid) continue;
    if (original && pid === original.id) return `Không thể chọn chính người này làm ${role}.`;
    const parent = index.byId.get(pid);
    if (!parent) return `Người ${role} đã chọn không còn trong danh sách, hãy chọn lại.`;
    if (below.has(pid)) return `${parent.name} là con cháu của người này, không thể làm ${role}.`;
    if (parent.generation + 1 !== form.generation)
      return `Đời phải là ${parent.generation + 1} vì ${role} là ${parent.name} ở đời ${parent.generation}.`;
  }
  if (original && original.generation !== form.generation) {
    const n = below.size;
    if (n > 0) return `Người này có ${n} con cháu nối theo; đổi đời sẽ làm lệch cả nhánh. Hãy sửa từ người cha trở xuống.`;
  }
  return null;
}
