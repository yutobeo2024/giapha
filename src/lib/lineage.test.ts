// Chạy: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FamilyMember } from "../types";
import { indexMembers, parentLabel, countDescendants, derivedGeneration, lineageError, treeParents } from "./lineage.ts";
import { computeTreeLayout } from "./treeLayout3d.ts";

const M = (id: string, generation: number, fatherId?: string, extra: Partial<FamilyMember> = {}): FamilyMember => ({
  id,
  name: `Ông ${id}`,
  gender: "Nam",
  generation,
  ...(fatherId ? { fatherId } : {}),
  ...extra,
});

// Tổ (1) → A (2) → B (3) → C (4); A còn con gái D (3)
const members = [M("to", 1), M("A", 2, "to"), M("B", 3, "A"), M("C", 4, "B"), M("D", 3, "A", { gender: "Nữ", name: "Bà D" })];
const index = indexMembers(members);
const byId = index.byId;

test("nhãn cha để phân biệt người trùng tên", () => {
  assert.equal(parentLabel(byId.get("B")!, byId), "con ông Ông A");
  assert.equal(parentLabel(byId.get("to")!, byId), "");
  assert.equal(parentLabel({ motherId: "D" }, byId), "con bà Bà D");
  assert.equal(parentLabel({ fatherId: "khong-co" }, byId), "");
});

test("đếm con cháu", () => {
  assert.equal(countDescendants("to", index.childrenOf), 4);
  assert.equal(countDescendants("A", index.childrenOf), 3);
  assert.equal(countDescendants("C", index.childrenOf), 0);
});

test("đếm con cháu không treo khi dữ liệu có vòng lặp", () => {
  const loop = indexMembers([M("x", 1, "y"), M("y", 2, "x")]);
  assert.equal(countDescendants("x", loop.childrenOf), 1);
});

test("đời suy ra từ cha, không có cha thì từ mẹ", () => {
  assert.equal(derivedGeneration({ fatherId: "A" }, byId), 3);
  assert.equal(derivedGeneration({ motherId: "D" }, byId), 4);
  assert.equal(derivedGeneration({ fatherId: "A", motherId: "to" }, byId), 3);
  assert.equal(derivedGeneration({}, byId), null);
  assert.equal(derivedGeneration({ fatherId: "khong-co" }, byId), null);
});

test("hợp lệ: thêm người mới đúng đời cha + 1", () => {
  assert.equal(lineageError({ generation: 3, fatherId: "A" }, null, index), null);
  assert.equal(lineageError({ generation: 7 }, null, index), null);
});

test("chặn: đời không bằng đời cha + 1", () => {
  assert.match(lineageError({ generation: 4, fatherId: "A" }, null, index)!, /Đời phải là 3/);
  assert.match(lineageError({ generation: 2, fatherId: "A" }, null, index)!, /Đời phải là 3/);
});

test("chặn: cha không tồn tại, là chính mình, hoặc là con cháu mình", () => {
  assert.match(lineageError({ generation: 3, fatherId: "khong-co" }, null, index)!, /không còn trong danh sách/);
  const a = byId.get("A")!;
  assert.match(lineageError({ generation: 3, fatherId: "A" }, a, index)!, /chính người này/);
  assert.match(lineageError({ generation: 5, fatherId: "C" }, a, index)!, /con cháu của người này/);
});

test("chặn: đổi đời của người đã có con cháu; người chưa có con thì được", () => {
  const a = byId.get("A")!;
  assert.match(lineageError({ generation: 5 }, a, index)!, /3 con cháu/);
  const c = byId.get("C")!;
  assert.equal(lineageError({ generation: 9 }, c, index), null);
});

test("sửa người cũ mà giữ nguyên đời và cha thì hợp lệ", () => {
  const b = byId.get("B")!;
  assert.equal(lineageError({ generation: 3, fatherId: "A" }, b, index), null);
});


test("treeParents: cha trước, không có cha thì mẹ; cha đã bị xóa thì thành gốc", () => {
  const p = treeParents([M("A", 1), M("B", 2, "A"), M("C", 3, undefined, { motherId: "B" }), M("D", 5, "da-xoa")]);
  assert.equal(p.get("A"), undefined);
  assert.equal(p.get("B"), "A");
  assert.equal(p.get("C"), "B");
  assert.equal(p.get("D"), undefined);
});

test("treeParents: dữ liệu lỗi có vòng lặp được cắt ở người đời thấp nhất, không ai mất", () => {
  // X ↔ Y nối dưới gốc R qua Z (Z là con Y): vòng X-Y không có đường lên R
  const list = [M("R", 1), M("X", 4, "Y"), M("Y", 5, "X"), M("Z", 6, "Y"), M("S", 2, "S")];
  const p = treeParents(list);
  assert.equal(p.get("X"), undefined, "X đời 4 thấp hơn Y nên thành gốc");
  assert.equal(p.get("Y"), "X");
  assert.equal(p.get("Z"), "Y");
  assert.equal(p.get("S"), undefined, "tự làm cha mình");
  // Đi ngược từ bất kỳ ai cũng phải dừng
  for (const m of list) {
    let steps = 0;
    for (let cur = p.get(m.id); cur; cur = p.get(cur)) assert.ok(++steps < list.length, `vòng lặp từ ${m.id}`);
  }
});

test("cây 3D: người trong vòng lặp hoặc tự làm cha mình vẫn có mặt", () => {
  const list = [M("R", 1), M("A", 2, "B"), M("B", 3, "A"), M("S", 2, "S"), M("K", 2, "R")];
  const layout = computeTreeLayout(list);
  assert.equal(layout.nodes.length, list.length);
});
