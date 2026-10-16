// Chạy: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutTree, planPages, MIN_SCALE, MAX_SCALE, SLOT, ROW, GAP_Y, A3 } from "./treeLayout.ts";

type P = { id: string; kids?: P[] };
const p = (id: string, ...kids: P[]): P => ({ id, kids });
const kidsOf = (x: P) => x.kids ?? [];

test("lá xếp liền nhau, cha nằm giữa con đầu và con cuối", () => {
  const t = layoutTree([p("A", p("B", p("D"), p("E")), p("C"))], kidsOf);
  const at = Object.fromEntries(t.nodes.map((n) => [n.item.id, n]));
  assert.equal(t.slots, 3);
  assert.equal(t.depths, 3);
  assert.deepEqual([at.D.x, at.E.x, at.C.x], [0, 1, 2]);
  assert.equal(at.B.x, 0.5);
  assert.equal(at.A.x, 1.25);
  assert.deepEqual([at.A.depth, at.B.depth, at.D.depth], [0, 1, 2]);
});

test("nhiều gốc nối tiếp nhau theo chiều ngang", () => {
  const t = layoutTree([p("A", p("B")), p("C")], kidsOf);
  assert.equal(t.roots.length, 2);
  assert.deepEqual(t.roots.map((r) => r.x), [0, 1]);
  assert.equal(t.slots, 2);
});

test("nhánh thu gọn: ghi số con không in", () => {
  const full = p("A", p("B"), p("C"), p("D"));
  const t = layoutTree([full], () => [], (x) => kidsOf(x).length);
  assert.equal(t.nodes.length, 1);
  assert.equal(t.roots[0].hidden, 3);
  assert.equal(t.slots, 1);
});

test("dữ liệu có vòng lặp không làm treo", () => {
  const a: P = { id: "A" };
  const b: P = { id: "B", kids: [a] };
  a.kids = [b];
  const t = layoutTree([a], kidsOf);
  assert.deepEqual(t.nodes.map((n) => n.item.id), ["A", "B"]);
});

test("nhánh nhỏ: 1 tờ, chữ được phóng to nhưng không quá MAX_SCALE", () => {
  const plan = planPages(3, 2);
  assert.equal(plan.cols * plan.rows, 1);
  assert.equal(plan.scale, MAX_SCALE);
});

test("nhánh vừa 1 tờ A3 ở chữ nhỏ nhất thì không chia tờ", () => {
  const plan = planPages(25, 7);
  assert.equal(plan.cols * plan.rows, 1);
  assert.equal(plan.orientation, "landscape");
  assert.ok(plan.scale >= MIN_SCALE);
  assert.ok(plan.slotsPerPage * SLOT * plan.scale <= plan.areaW + 1e-9);
});

test("cây rộng: chia nhiều tờ, mọi tờ chữ không nhỏ hơn MIN_SCALE và nội dung nằm gọn trong vùng in", () => {
  for (const [slots, depths] of [[72, 10], [497, 15], [1094, 21], [30, 30], [5, 40]]) {
    const plan = planPages(slots, depths);
    assert.ok(plan.scale >= MIN_SCALE - 1e-9, `${slots}×${depths}: tỉ lệ ${plan.scale}`);
    assert.ok(plan.cols * plan.slotsPerPage >= slots);
    assert.ok(plan.rows * plan.depthsPerPage >= depths);
    assert.ok(plan.slotsPerPage * SLOT * plan.scale <= plan.areaW + 1e-9);
    const h = plan.rows === 1 ? plan.depthsPerPage * ROW - GAP_Y : plan.depthsPerPage * ROW;
    assert.ok(h * plan.scale <= plan.areaH + 1e-9);
    assert.equal(plan.areaW, plan.pageW - 2 * A3.side);
  }
});

test("phần đang mở mặc định (72 ô × 10 đời) cần 3 tờ A3, chia đều 24 ô mỗi tờ", () => {
  const plan = planPages(72, 10);
  assert.equal(plan.cols * plan.rows, 3);
  assert.equal(plan.slotsPerPage, 24);
});

test("cây cao và hẹp thì chọn giấy dọc", () => {
  const plan = planPages(10, 18);
  assert.equal(plan.orientation, "portrait");
  assert.equal(plan.cols * plan.rows, 1);
});
