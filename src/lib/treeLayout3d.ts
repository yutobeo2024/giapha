import type { FamilyMember } from "../types";

/** Một điểm 3D đơn giản, không phụ thuộc three.js để hàm bố cục chạy được ở mọi nơi. */
export type Vec3 = [number, number, number];

export interface LayoutNode {
  member: FamilyMember;
  position: Vec3;
  /** Góc quanh thân (radian), dùng cho camera và nhãn */
  angle: number;
  /** Số "lá" (hậu duệ không có con) trong nhánh, quyết định độ rộng nhánh */
  leaves: number;
  isRoot: boolean;
  /** Bán kính thân/cành tại nút (0 nếu không có con) để vẽ mắt gỗ và làm đốm sáng to hơn thân */
  woodRadius: number;
}

/** Loại ống gỗ: quyết định cách thuôn và độ gồ ghề khi dựng hình */
export type BranchKind = "trunk" | "buttress" | "rootlet" | "aerial" | "branch";

export interface LayoutBranch {
  fromId: string;
  toId: string;
  /** Điểm điều khiển cho đường cong (CatmullRom) từ cha tới con */
  points: Vec3[];
  /** Bán kính ống ở đầu cha và đầu con */
  radiusStart: number;
  radiusEnd: number;
  generation: number;
  kind: BranchKind;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  branches: LayoutBranch[];
  /** Thân dưới gốc, rễ bạnh, rễ con và rễ khí: vẽ như các nhánh */
  roots: LayoutBranch[];
  minGen: number;
  maxGen: number;
  /** Độ cao y của mỗi đời */
  heightOf: (gen: number) => number;
  /** Bán kính tán lớn nhất ở mỗi đời (để đặt camera) */
  spreadOf: (gen: number) => number;
  groundY: number;
  /** Thân chính: bán kính ở gốc (đã loe) và ở đỉnh (chỗ chia cành), độ cao đỉnh */
  trunk: { baseRadius: number; topRadius: number; topY: number; rootSpread: number };
}

/** Khoảng cách dọc giữa hai đời */
export const GEN_HEIGHT = 1.5;
/** Mặt đất thấp hơn Thủy tổ để có thân trụ cao, gốc loe và rễ bạnh */
const GROUND_Y = -5.0;

/** Hash ổn định từ chuỗi → [0,1) để nhiễu không đổi giữa các lần render */
function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Bán kính (khoảng cách ra khỏi trục thân) theo đời: đời 2 thoát khỏi thân to, càng lên càng xòe. */
function radiusFor(genIndex: number): number {
  if (genIndex <= 0) return 0;
  if (genIndex === 1) return 1.3;
  if (genIndex === 2) return 2.1;
  return 2.1 + Math.pow(genIndex - 2, 1.08) * 0.95;
}

/** "Pipe model" của cây thật: nhánh nuôi nhiều lá thì to, nhánh ít lá thì mảnh. Hệ số lớn cho dáng cổ thụ. */
export function pipeRadius(leaves: number): number {
  return Math.max(0.035, 0.13 * Math.pow(leaves, 0.5));
}

/** Thân chính không bao giờ mảnh hơn mức này dù dữ liệu còn ít đời */
const TRUNK_MIN_RADIUS = 1.05;
const TRUNK_FLARE = 1.7;

/**
 * Tính bố cục cây 3D kiểu "sunburst quanh thân":
 * mỗi nút nhận một cung góc tỉ lệ với số lá trong nhánh của nó, đặt ở giữa cung,
 * độ cao theo đời, bán kính tăng dần theo đời.
 */
export function computeTreeLayout(members: FamilyMember[]): TreeLayout {
  const byIdMember = new Map(members.map((m) => [m.id, m]));
  const children = new Map<string, FamilyMember[]>();
  const parentOf = (m: FamilyMember) =>
    (m.fatherId && byIdMember.has(m.fatherId) ? m.fatherId : undefined) ??
    (m.motherId && byIdMember.has(m.motherId) ? m.motherId : undefined);

  for (const m of members) {
    const p = parentOf(m);
    if (!p) continue;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(m);
  }
  // Thứ tự con ổn định: con trai trước, rồi theo tên
  for (const list of children.values()) {
    list.sort((a, b) => (a.gender === b.gender ? a.name.localeCompare(b.name, "vi") : a.gender === "Nam" ? -1 : 1));
  }

  const roots = members.filter((m) => !parentOf(m)).sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, "vi"));
  const minGen = members.length ? Math.min(...members.map((m) => m.generation)) : 1;
  const maxGen = members.length ? Math.max(...members.map((m) => m.generation)) : 1;
  const heightOf = (gen: number) => (gen - minGen) * GEN_HEIGHT;

  const leafMemo = new Map<string, number>();
  const leavesOf = (id: string): number => {
    if (leafMemo.has(id)) return leafMemo.get(id)!;
    const kids = children.get(id) || [];
    const v = kids.length ? kids.reduce((s, k) => s + leavesOf(k.id), 0) : 1;
    leafMemo.set(id, v);
    return v;
  };

  const nodes: LayoutNode[] = [];
  const byId = new Map<string, LayoutNode>();
  const branches: LayoutBranch[] = [];
  const spreadByGen = new Map<number, number>();

  // Thứ tự DFS các lá: dàn đều quanh 360 độ để tán tròn và cân đối,
  // mỗi nút trong nằm giữa dải lá của nó nên nhánh con luôn ở cạnh cha.
  const leafRange = new Map<string, [number, number]>();
  let leafCursor = 0;
  // Lá ở đời thấp (gần thân) chiếm ít góc hơn để tán phía trên phủ kín vòng tròn
  const leafWeight = (m: FamilyMember) => {
    const g = m.generation - minGen;
    return g <= 2 ? 0.2 : g <= 4 ? 0.45 : 1;
  };
  const visit = (m: FamilyMember) => {
    const kids = children.get(m.id) || [];
    if (!kids.length) {
      const w = leafWeight(m);
      leafRange.set(m.id, [leafCursor, leafCursor + w]);
      leafCursor += w;
      return;
    }
    const first = leafCursor;
    for (const k of kids) visit(k);
    leafRange.set(m.id, [first, leafCursor]);
  };
  for (const r of roots) visit(r);
  const totalLeaves = Math.max(1e-6, leafCursor);
  const angleOf = (id: string) => {
    const [a, b] = leafRange.get(id) || [0, 0];
    return -Math.PI / 2 + ((a + b) / 2 / totalLeaves) * Math.PI * 2;
  };

  // Tổng số lá (không trọng số) để tính "phần gánh" của mỗi nút
  const totalLeafCount = roots.reduce((s, r) => s + leavesOf(r.id), 0) || 1;

  const place = (m: FamilyMember, isRoot: boolean) => {
    const genIndex = m.generation - minGen;
    const angle = angleOf(m.id);
    const jitterR = (hash01(m.id, 1) - 0.5) * 0.4 * Math.min(1, genIndex / 3);
    const jitterY = (hash01(m.id, 2) - 0.5) * 0.5 * Math.min(1, genIndex / 2);
    // Nút gánh phần lớn hậu duệ nằm sát trục (thân cây tiếp tục vươn lên), nút ít hậu duệ tỏa ra ngoài
    const pull = Math.pow(leavesOf(m.id) / totalLeafCount, 0.6);
    const r = Math.max(0, radiusFor(genIndex) * (1 - 0.88 * pull) + jitterR * (1 - pull));
    const pos: Vec3 = [Math.cos(angle) * r, heightOf(m.generation) + jitterY, Math.sin(angle) * r];
    const hasKids = (children.get(m.id) || []).length > 0;
    const node: LayoutNode = { member: m, position: pos, angle, leaves: leavesOf(m.id), isRoot, woodRadius: hasKids ? pipeRadius(leavesOf(m.id)) : 0 };
    nodes.push(node);
    byId.set(m.id, node);
    spreadByGen.set(m.generation, Math.max(spreadByGen.get(m.generation) || 0, r));
    for (const k of children.get(m.id) || []) place(k, false);
  };
  for (const r of roots) place(r, true);

  // Giãn các đốm cùng đời quá sát nhau: đẩy ra trên vòng tròn tới khi cách nhau ít nhất MIN_GAP
  const MIN_GAP = 0.7;
  const byGen = new Map<number, LayoutNode[]>();
  for (const n of nodes) {
    if (!byGen.has(n.member.generation)) byGen.set(n.member.generation, []);
    byGen.get(n.member.generation)!.push(n);
  }
  for (const list of byGen.values()) {
    if (list.length < 2) continue;
    const r = Math.max(0.3, list.reduce((s, n) => s + Math.hypot(n.position[0], n.position[2]), 0) / list.length);
    const minArc = Math.min(MIN_GAP / r, (Math.PI * 2) / list.length);
    for (let iter = 0; iter < 80; iter++) {
      list.sort((a, b) => a.angle - b.angle);
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const b = list[(i + 1) % list.length];
        let gap = b.angle - a.angle;
        if (i === list.length - 1) gap += Math.PI * 2;
        if (gap < minArc) {
          const push = (minArc - gap) / 2;
          a.angle -= push;
          b.angle += push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const n of list) {
      const rr = Math.hypot(n.position[0], n.position[2]);
      n.position = [Math.cos(n.angle) * rr, n.position[1], Math.sin(n.angle) * rr];
    }
  }

  // Thân chính: bán kính ở đỉnh (chỗ Thủy tổ, nơi chia cành) và ở gốc (loe)
  const mainRoot = nodes.find((n) => n.isRoot);
  const trunkTop = Math.max(TRUNK_MIN_RADIUS, mainRoot ? pipeRadius(mainRoot.leaves) : TRUNK_MIN_RADIUS);
  const trunkBase = trunkTop * TRUNK_FLARE;
  if (mainRoot) mainRoot.woodRadius = trunkTop;

  // Nhánh cha → con: cong lên trên rồi tỏa ra
  for (const n of nodes) {
    const kids = children.get(n.member.id) || [];
    for (const k of kids) {
      const c = byId.get(k.id)!;
      const [px, py, pz] = n.position;
      const [cx, cy, cz] = c.position;
      const lift = GEN_HEIGHT * 0.55;
      const p1: Vec3 = [px + (cx - px) * 0.15, py + lift * 0.6, pz + (cz - pz) * 0.15];
      const p2: Vec3 = [px + (cx - px) * 0.7, cy - lift * 0.25, pz + (cz - pz) * 0.7];
      const kidKids = children.get(k.id) || [];
      const endLeaves = kidKids.length ? Math.max(...kidKids.map((x) => leavesOf(x.id))) : 1;
      // Cành từ Thủy tổ (đời 1) là các "cành cái" to, nối thẳng vào thân
      const fromTrunk = n.isRoot;
      branches.push({
        fromId: n.member.id,
        toId: k.id,
        points: [n.position, p1, p2, c.position],
        radiusStart: fromTrunk ? Math.max(pipeRadius(leavesOf(k.id)) * 1.15, trunkTop * 0.42) : pipeRadius(leavesOf(k.id)),
        radiusEnd: pipeRadius(Math.max(1, Math.min(leavesOf(k.id), endLeaves))) * 0.85,
        generation: k.generation,
        kind: "branch",
      });
    }
  }

  // Thân dưới gốc + rễ bạnh lan trên mặt đất + rễ con + rễ khí rủ quanh thân (cây đa cổ thụ)
  const rootBranches: LayoutBranch[] = [];
  let rootSpread = 0;
  if (mainRoot) {
    const [rx, ry, rz] = mainRoot.position;
    rootBranches.push({
      fromId: "__ground",
      toId: mainRoot.member.id,
      points: [[0, GROUND_Y - 0.3, 0], [0, GROUND_Y + 1.2, 0], [rx * 0.3, ry - 1.4, rz * 0.3], mainRoot.position],
      radiusStart: trunkBase,
      radiusEnd: trunkTop,
      generation: minGen,
      kind: "trunk",
    });

    const BUTTRESSES = 8;
    for (let i = 0; i < BUTTRESSES; i++) {
      const a = (i / BUTTRESSES) * Math.PI * 2 + 0.3 + (hash01("ba" + i) - 0.5) * 0.35;
      const len = 3.6 + hash01("root" + i) * 2.0;
      rootSpread = Math.max(rootSpread, len);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const bend = (hash01("bend" + i) - 0.5) * 0.9;
      const main: Vec3[] = [
        [ca * trunkTop * 0.55, GROUND_Y + 1.15, sa * trunkTop * 0.55],
        [ca * trunkBase * 0.95, GROUND_Y + 0.4, sa * trunkBase * 0.95],
        [Math.cos(a + bend * 0.3) * len * 0.55, GROUND_Y + 0.02, Math.sin(a + bend * 0.3) * len * 0.55],
        [Math.cos(a + bend * 0.5) * len, GROUND_Y - 0.12, Math.sin(a + bend * 0.5) * len],
      ];
      rootBranches.push({
        fromId: "__ground",
        toId: "__root" + i,
        points: main,
        radiusStart: trunkTop * 0.55,
        radiusEnd: 0.05,
        generation: minGen,
        kind: "buttress",
      });
      // Rễ con rẽ nhánh từ giữa rễ bạnh
      const subs = 1 + (hash01("subn" + i) > 0.45 ? 1 : 0);
      for (let s = 0; s < subs; s++) {
        const side = s === 0 ? 1 : -1;
        const sa2 = a + side * (0.5 + hash01("suba" + i + s) * 0.35);
        const t0 = 0.4 + hash01("subt" + i + s) * 0.2;
        const start: Vec3 = [Math.cos(a + bend * 0.2) * len * t0, GROUND_Y + 0.05, Math.sin(a + bend * 0.2) * len * t0];
        const sl = len * (0.35 + hash01("subl" + i + s) * 0.3);
        rootBranches.push({
          fromId: "__root" + i,
          toId: `__rootlet${i}_${s}`,
          points: [
            start,
            [start[0] + Math.cos(sa2) * sl * 0.4, GROUND_Y - 0.02, start[2] + Math.sin(sa2) * sl * 0.4],
            [start[0] + Math.cos(sa2) * sl, GROUND_Y - 0.15, start[2] + Math.sin(sa2) * sl],
          ],
          radiusStart: trunkTop * 0.16,
          radiusEnd: 0.03,
          generation: minGen,
          kind: "rootlet",
        });
      }
    }

    // Rễ khí: sợi rủ từ thân xuống, vài sợi chạm đất
    const AERIAL = 10;
    for (let i = 0; i < AERIAL; i++) {
      const a = (i / AERIAL) * Math.PI * 2 + 0.9 + (hash01("aa" + i) - 0.5) * 0.5;
      const y0 = GROUND_Y + 2.0 + hash01("ay" + i) * 1.6;
      const rAt = trunkTop * (1 + 0.5 * Math.pow((mainRoot.position[1] - y0) / (mainRoot.position[1] - GROUND_Y), 2.2));
      const reach = trunkBase + 0.5 + hash01("ar" + i) * 1.4;
      const touches = hash01("at" + i) > 0.4;
      const yEnd = touches ? GROUND_Y - 0.1 : GROUND_Y + 0.6 + hash01("ae" + i) * 1.0;
      rootBranches.push({
        fromId: "__trunk",
        toId: "__aerial" + i,
        points: [
          [Math.cos(a) * rAt * 0.9, y0, Math.sin(a) * rAt * 0.9],
          [Math.cos(a) * (rAt + 0.35), y0 - 0.5, Math.sin(a) * (rAt + 0.35)],
          [Math.cos(a + 0.08) * reach * 0.9, (y0 + yEnd) / 2, Math.sin(a + 0.08) * reach * 0.9],
          [Math.cos(a + 0.12) * reach, yEnd, Math.sin(a + 0.12) * reach],
        ],
        radiusStart: 0.07 + hash01("aw" + i) * 0.05,
        radiusEnd: 0.025,
        generation: minGen,
        kind: "aerial",
      });
    }
  }

  return {
    nodes,
    byId,
    branches,
    roots: rootBranches,
    minGen,
    maxGen,
    heightOf,
    spreadOf: (gen: number) => Math.max(gen === minGen ? trunkTop : 0, spreadByGen.get(gen) ?? radiusFor(gen - minGen)),
    groundY: GROUND_Y,
    trunk: { baseRadius: trunkBase, topRadius: trunkTop, topY: mainRoot ? mainRoot.position[1] : 0, rootSpread },
  };
}
