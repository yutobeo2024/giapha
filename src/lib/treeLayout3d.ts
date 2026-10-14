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

export interface LayoutBranch {
  fromId: string;
  toId: string;
  /** Điểm điều khiển cho đường cong (CatmullRom) từ cha tới con */
  points: Vec3[];
  /** Bán kính ống ở đầu cha và đầu con */
  radiusStart: number;
  radiusEnd: number;
  generation: number;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  branches: LayoutBranch[];
  /** Rễ và thân dưới gốc, vẽ như các nhánh */
  roots: LayoutBranch[];
  minGen: number;
  maxGen: number;
  /** Độ cao y của mỗi đời */
  heightOf: (gen: number) => number;
  /** Bán kính tán lớn nhất ở mỗi đời (để đặt camera) */
  spreadOf: (gen: number) => number;
  groundY: number;
}

/** Khoảng cách dọc giữa hai đời */
export const GEN_HEIGHT = 1.55;
const GROUND_Y = -2.2;

/** Hash ổn định từ chuỗi → [0,1) để nhiễu không đổi giữa các lần render */
function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Bán kính (khoảng cách ra khỏi trục thân) theo đời: đời đầu sát thân, càng lên càng xòe. */
function radiusFor(genIndex: number): number {
  if (genIndex <= 0) return 0;
  if (genIndex === 1) return 0.55;
  if (genIndex === 2) return 0.95;
  return 0.95 + Math.pow(genIndex - 2, 1.08) * 0.82;
}

/** "Pipe model" của cây thật: nhánh nuôi nhiều lá thì to, nhánh ít lá thì mảnh. */
function pipeRadius(leaves: number): number {
  return Math.max(0.022, 0.06 * Math.pow(leaves, 0.45));
}

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

  const place = (m: FamilyMember, isRoot: boolean) => {
    const genIndex = m.generation - minGen;
    const angle = angleOf(m.id);
    const jitterR = (hash01(m.id, 1) - 0.5) * 0.35 * Math.min(1, genIndex / 3);
    const jitterY = (hash01(m.id, 2) - 0.5) * 0.45 * Math.min(1, genIndex / 2);
    const r = Math.max(0, radiusFor(genIndex) + jitterR);
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
  const MIN_GAP = 0.6;
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
      branches.push({
        fromId: n.member.id,
        toId: k.id,
        points: [n.position, p1, p2, c.position],
        radiusStart: pipeRadius(leavesOf(k.id)),
        radiusEnd: pipeRadius(Math.max(1, Math.min(leavesOf(k.id), endLeaves))) * 0.85,
        generation: k.generation,
      });
    }
  }

  // Thân dưới gốc chính + bộ rễ tỏa trên mặt đất
  const rootBranches: LayoutBranch[] = [];
  const mainRoot = nodes.find((n) => n.isRoot);
  if (mainRoot) {
    const [rx, ry, rz] = mainRoot.position;
    rootBranches.push({
      fromId: "__ground",
      toId: mainRoot.member.id,
      points: [[0, GROUND_Y, 0], [0, GROUND_Y + 0.8, 0], [rx * 0.5, ry - 0.6, rz * 0.5], mainRoot.position],
      radiusStart: pipeRadius(mainRoot.leaves) * 1.45,
      radiusEnd: pipeRadius(mainRoot.leaves),
      generation: minGen,
    });
    const ROOTS = 7;
    for (let i = 0; i < ROOTS; i++) {
      const a = (i / ROOTS) * Math.PI * 2 + 0.3;
      const len = 1.6 + hash01("root" + i) * 1.4;
      rootBranches.push({
        fromId: "__ground",
        toId: "__root" + i,
        points: [
          [0, GROUND_Y + 0.5, 0],
          [Math.cos(a) * 0.5, GROUND_Y + 0.1, Math.sin(a) * 0.5],
          [Math.cos(a) * len * 0.6, GROUND_Y - 0.05, Math.sin(a) * len * 0.6],
          [Math.cos(a) * len, GROUND_Y - 0.15, Math.sin(a) * len],
        ],
        radiusStart: pipeRadius(mainRoot.leaves) * 0.5,
        radiusEnd: 0.02,
        generation: minGen,
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
    spreadOf: (gen: number) => spreadByGen.get(gen) ?? radiusFor(gen - minGen),
    groundY: GROUND_Y,
  };
}
