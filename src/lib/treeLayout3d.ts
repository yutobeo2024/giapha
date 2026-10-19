import type { FamilyMember } from "../types";
import { treeParents } from "./lineage.ts";

/** Một điểm 3D đơn giản, không phụ thuộc three.js để hàm bố cục chạy được ở mọi nơi. */
export type Vec3 = [number, number, number];

export interface LayoutNode {
  member: FamilyMember;
  position: Vec3;
  /** Góc quanh thân (radian), dùng cho camera và nhãn */
  angle: number;
  /** Số "lá" (hậu duệ không có con) trong nhánh, quyết định độ to của cành */
  leaves: number;
  isRoot: boolean;
  /** Bán kính gỗ tại nút (0 nếu là đầu cành) để đặt viên ngọc trên vỏ */
  woodRadius: number;
}

/** twig: cành con mảnh nối người không có con vào gỗ của cha (dựng rẻ hơn, không nắp) */
export type ChainKind = "trunk" | "branch" | "root" | "twig";

/**
 * Một "trục" gỗ liền mạch như cây thật: thân chạy thẳng qua dòng chính, mỗi cành con là một chuỗi
 * mọc ra từ trong lòng cành mẹ. Bán kính và đời được cho tại từng điểm, dựng hình nội suy theo chiều dài.
 */
export interface LayoutChain {
  id: string;
  kind: ChainKind;
  points: Vec3[];
  radii: number[];
  /** Đời tại từng điểm (hiệu ứng mọc dần theo đời) */
  gens: number[];
  /** Đầu chuỗi nằm trong lòng gỗ khác nên không cần nắp */
  startInside: boolean;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  chains: LayoutChain[];
  minGen: number;
  maxGen: number;
  /** Độ cao đặc trưng của mỗi đời (trung bình, tăng dần theo đời) */
  heightOf: (gen: number) => number;
  /** Độ xòe của tán ở mỗi đời (để đặt camera) */
  spreadOf: (gen: number) => number;
  groundY: number;
  /** Thân chính: bán kính ở gốc (đã loe) và ở đỉnh (chỗ chia cành), độ cao đỉnh, độ loe của gốc trên mặt đất */
  trunk: { baseRadius: number; topRadius: number; topY: number; rootSpread: number };
  /** Kích thước tán (để hiệu ứng gió biết phần nào mềm, phần nào cứng) */
  crown: { height: number; radius: number };
}

/** Khoảng cách dọc tham chiếu giữa hai đời (camera dùng để chừa lề) */
export const GEN_HEIGHT = 1.5;
/** Bán kính đầu cành (ngọn thon) */
export const TIP_RADIUS = 0.04;
/** Bán kính thân ở chỗ Thủy tổ, cố định để cây không phình to khi gia phả thêm người */
const TRUNK_TOP_RADIUS = 1.35;
const TRUNK_FLARE = 1.9;
/** Dòng kế thừa còn gánh ít nhất chừng này hậu duệ thì thân cây vẫn đi tiếp qua người đó */
const SPINE_SHARE = 0.6;

/** Hash ổn định từ chuỗi → [0,1) để nhiễu không đổi giữa các lần render */
function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * "Pipe model" của cây thật, chuẩn hoá theo thân: tổng tiết diện các cành con bằng tiết diện cành mẹ,
 * nên bán kính tỉ lệ căn bậc hai số lá trong nhánh so với cả cây.
 */
function pipeRadiusOf(leaves: number, rootLeaves: number): number {
  return Math.max(0.05, TRUNK_TOP_RADIUS * Math.sqrt(leaves / Math.max(1, rootLeaves)));
}

const DEG = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

const v3 = {
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};

/** Xoay hướng `from` về phía `to` nhưng không quá `maxAngle` (radian): cành đổi hướng từ từ, không gãy khúc */
function rotateTowards(from: Vec3, to: Vec3, maxAngle: number): Vec3 {
  const f = v3.norm(from);
  const t = v3.norm(to);
  const cos = clamp(v3.dot(f, t), -1, 1);
  const ang = Math.acos(cos);
  if (ang <= maxAngle || ang < 1e-4) return t;
  const k = maxAngle / ang;
  const s = Math.sin(ang);
  const w0 = Math.sin((1 - k) * ang) / s;
  const w1 = Math.sin(k * ang) / s;
  return v3.norm(v3.add(v3.scale(f, w0), v3.scale(t, w1)));
}

/** Hai vectơ vuông góc với `d` (để xoay quanh trục d) */
function basis(d: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const p1 = v3.norm(v3.cross(d, helper));
  const p2 = v3.norm(v3.cross(d, p1));
  return [p1, p2];
}

/**
 * Bố cục cây 3D theo dáng cây cổ thụ thật:
 * - Thân: một đường cong liền từ rễ lên qua các đời đầu (dòng kế thừa gánh hầu hết hậu duệ), nghiêng nhẹ.
 * - Cành: mỗi người có con là một mắt cành; cành mọc tiếp theo hướng cành mẹ và từ từ ngoặt về phần tán
 *   được chia cho nhánh mình (chếch lên ở gốc cành, ngả dần ra ngoài, cành mảnh rủ ở ngọn).
 * - Người không có con không thành cành riêng mà treo thành chùm ở đầu cành của cha, như chùm lá;
 *   mỗi người được nối vào gỗ của cha bằng một cành con mảnh (twig) sau khi đã dọn chồng.
 */
export function computeTreeLayout(members: FamilyMember[]): TreeLayout {
  const children = new Map<string, FamilyMember[]>();
  const parents = treeParents(members);
  const parentOf = (m: FamilyMember) => parents.get(m.id);

  for (const m of members) {
    const p = parentOf(m);
    if (!p) continue;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(m);
  }

  const roots = members.filter((m) => !parentOf(m)).sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, "vi"));
  const minGen = members.length ? Math.min(...members.map((m) => m.generation)) : 1;
  const maxGen = members.length ? Math.max(...members.map((m) => m.generation)) : 1;
  const hasKids = (id: string) => (children.get(id) || []).length > 0;

  const leafMemo = new Map<string, number>();
  const leavesOf = (id: string): number => {
    if (leafMemo.has(id)) return leafMemo.get(id)!;
    const kids = children.get(id) || [];
    const v = kids.length ? kids.reduce((s, k) => s + leavesOf(k.id), 0) : 1;
    leafMemo.set(id, v);
    return v;
  };
  // Số đời con cháu nối tiếp dài nhất phía dưới mỗi người
  const restMemo = new Map<string, number>();
  const restOf = (id: string): number => {
    if (restMemo.has(id)) return restMemo.get(id)!;
    const kids = children.get(id) || [];
    const v = kids.length ? 1 + Math.max(...kids.map((k) => restOf(k.id))) : 0;
    restMemo.set(id, v);
    return v;
  };
  const kidsByLeaves = (id: string) =>
    [...(children.get(id) || [])].sort((a, b) => leavesOf(b.id) - leavesOf(a.id) || a.name.localeCompare(b.name, "vi"));
  const woodKids = (id: string) => kidsByLeaves(id).filter((k) => hasKids(k.id));
  const leafKids = (id: string) => kidsByLeaves(id).filter((k) => !hasKids(k.id));

  // ---------------------------------------------------------------- kích thước
  const genSpan = Math.max(1, maxGen - minGen);
  // Tỉ lệ cây sồi cổ thụ: tán rộng hơn cao, thân cao chừng một phần ba cả cây
  const CROWN_H = 4 + 0.8 * genSpan;
  const CROWN_R = 0.85 * CROWN_H;
  const GROUND_Y = -Math.max(4.5, 0.38 * CROWN_H);
  const trunkTop = TRUNK_TOP_RADIUS;
  const trunkBase = trunkTop * TRUNK_FLARE;
  const rootLeaves = Math.max(1, ...roots.map((r) => leavesOf(r.id)));

  // ---------------------------------------------------------------- thân chính (spine)
  // Thân cây đi tiếp qua người con gánh hầu hết hậu duệ, cho tới khi dòng họ thật sự chia nhánh
  const spine: FamilyMember[] = [];
  if (roots.length) {
    let cur = roots[0];
    spine.push(cur);
    const maxSpine = Math.max(2, Math.round(genSpan * 0.45));
    for (;;) {
      const kids = kidsByLeaves(cur.id);
      if (!kids.length) break;
      const main = kids[0];
      if (!hasKids(main.id) || leavesOf(main.id) / leavesOf(cur.id) < SPINE_SHARE || spine.length >= maxSpine) break;
      spine.push(main);
      cur = main;
    }
  }
  const spineDepth = new Map(spine.map((m, i) => [m.id, i]));
  // Các đời trên thân xếp sát nhau: thân chia cành trong một đoạn ngắn như cây sồi, không vươn thành cột cao
  const spineY = (k: number) => k * 0.75;
  /** Chiều dài trung bình một đoạn cành ứng với một đời, sao cho dòng dài nhất vươn tới mép tán */
  const STEP = (1.25 * CROWN_R) / Math.max(4, genSpan - spine.length + 2);
  const spineTopY = spineY(spine.length - 1);
  // Thân nghiêng nhẹ về một hướng cố định, cong dần (không gấp khúc)
  const leanAz = hash01(roots[0]?.id ?? "x", 11) * Math.PI * 2;
  const LEAN = 0.055 * CROWN_H;
  const leanAt = (y: number): [number, number] => {
    const t = clamp((y - GROUND_Y) / Math.max(1, spineTopY - GROUND_Y), 0, 1.4);
    const off = LEAN * Math.pow(t, 2.2);
    return [Math.cos(leanAz) * off, Math.sin(leanAz) * off];
  };
  const spinePos = (k: number): Vec3 => {
    const y = spineY(k);
    const [lx, lz] = leanAt(y);
    return [lx, y, lz];
  };

  // ---------------------------------------------------------------- đặt mắt cành
  const nodes: LayoutNode[] = [];
  const byId = new Map<string, LayoutNode>();
  const dirOf = new Map<string, Vec3>();
  const E_MIN = 4 * DEG;
  const E_MAX = 84 * DEG;
  type Cell = { a0: number; a1: number; u0: number; u1: number };
  const elevOf = (u: number) => Math.asin(Math.sin(E_MIN) + (Math.sin(E_MAX) - Math.sin(E_MIN)) * u);

  /**
   * Mỗi nhánh nhận một "ô" trên vòm tán (khoảng góc quanh thân × dải độ cao) tỉ lệ với số con cháu,
   * ô của cha chia cho các con theo chiều dài hơn. Người càng nhiều đời con cháu phía sau càng gần
   * thân, nên mỗi dòng đi dần từ trong ra mép tán. Vị trí "đích" ấy là nơi cành muốn tới; cành thật
   * mọc từ mắt cành của cha theo hướng cũ rồi ngoặt dần về đích (mỗi đời đổi hướng có hạn, đoạn cành
   * có độ dài tối đa), nên cành cong mềm, cành mảnh không thành que dài thẳng tắp.
   */
  const place = (m: FamilyMember, cell: Cell, parent: LayoutNode | null, dirIn: Vec3) => {
    const leaves = leavesOf(m.id);
    const depth = m.generation - minGen;
    const sk = spineDepth.get(m.id);
    const j = (salt: number) => hash01(m.id, salt) - 0.5;
    let pos: Vec3;
    let dir: Vec3;
    if (sk !== undefined) {
      pos = spinePos(sk);
      dir = sk === 0 ? [0, 1, 0] : v3.norm(v3.sub(pos, spinePos(sk - 1)));
    } else if (!parent) {
      pos = [0, 0, 0];
      dir = [0, 1, 0];
    } else {
      // Đích trên vòm
      const a = (cell.a0 + cell.a1) / 2 + j(1) * (cell.a1 - cell.a0) * 0.35;
      const u = clamp((cell.u0 + cell.u1) / 2 + j(2) * (cell.u1 - cell.u0) * 0.35, 0, 1);
      // Ô càng lớn (nhánh gánh càng nhiều hậu duệ) thì càng vươn lên như cành cái; ô nhỏ ngả theo hướng ô
      const big = clamp(((cell.a1 - cell.a0) / (Math.PI * 2)) * (cell.u1 - cell.u0) * 2.2, 0, 1);
      const e = elevOf(u) + (88 * DEG - elevOf(u)) * Math.pow(big, 0.7);
      const rest = restOf(m.id);
      const frac = 0.55 * (depth / (depth + rest)) + 0.45 * Math.min(1, depth / genSpan);
      const rho = Math.pow(frac, 0.85) * (1 + j(3) * 0.22);
      const ce = Math.cos(e);
      const px = ce * Math.cos(a) * rho;
      const pz = ce * Math.sin(a) * rho;
      const out = Math.hypot(px, pz);
      // Cành cái vươn xiên lên khỏi đỉnh thân rồi mới xòe: tán ngồi trên thân như cây sồi
      const target: Vec3 = [px * CROWN_R, Math.sin(e) * rho * CROWN_H * 0.95 + Math.min(1, out * 2.2) * CROWN_H * 0.22, pz * CROWN_R];
      // Mọc từ cha về phía đích: đổi hướng có hạn, đoạn cành có độ dài tối đa
      const share = leaves / Math.max(1, parent.leaves);
      const d = v3.sub(target, parent.position);
      const dist = v3.len(d) || 1e-3;
      const maxTurn = (22 + 32 * Math.pow(1 - clamp(share, 0, 1), 0.7)) * DEG;
      dir = rotateTowards(dirIn, v3.scale(d, 1 / dist), maxTurn);
      const bigness = Math.min(1, Math.log10(1 + leaves) / 2.2);
      const len = Math.min(dist, STEP * (0.7 + 1.1 * bigness) * (1 + j(4) * 0.2));
      pos = v3.add(parent.position, v3.scale(dir, Math.max(0.45, len)));
    }
    const node: LayoutNode = {
      member: m,
      position: pos,
      angle: Math.atan2(pos[2], pos[0]),
      leaves,
      isRoot: !parent,
      woodRadius: hasKids(m.id) ? pipeRadiusOf(leaves, rootLeaves) : 0,
    };
    nodes.push(node);
    byId.set(m.id, node);
    dirOf.set(m.id, dir);

    // Chia ô cho các con có con: con đông hậu duệ ở giữa, con ít hậu duệ xen hai bên
    const sorted = woodKids(m.id);
    const kids: FamilyMember[] = [];
    sorted.forEach((k, i) => (i % 2 ? kids.push(k) : kids.unshift(k)));
    const total = kids.reduce((s, k) => s + Math.pow(leavesOf(k.id), 0.92), 0) || 1;
    const midE = elevOf((cell.u0 + cell.u1) / 2);
    const widthA = (cell.a1 - cell.a0) * Math.cos(midE);
    const widthU = (elevOf(cell.u1) - elevOf(cell.u0)) * 1.1;
    // Ô hẹp thì chia theo chiều cao; thân chính luôn chia theo góc quanh thân
    const byAzimuth = sk !== undefined || widthA * (0.8 + 0.4 * hash01(m.id, 4)) >= widthU;
    let cursor = 0;
    for (const k of kids) {
      const w = Math.pow(leavesOf(k.id), 0.92) / total;
      const wobble = (hash01(k.id, 5) - 0.5) * w * 0.25;
      const f0 = cursor;
      const f1 = Math.min(1, cursor + w + wobble);
      cursor = f1;
      const sub: Cell = byAzimuth
        ? { a0: cell.a0 + (cell.a1 - cell.a0) * f0, a1: cell.a0 + (cell.a1 - cell.a0) * f1, u0: cell.u0, u1: cell.u1 }
        : { a0: cell.a0, a1: cell.a1, u0: cell.u0 + (cell.u1 - cell.u0) * f0, u1: cell.u0 + (cell.u1 - cell.u0) * f1 };
      place(k, sub, node, dir);
    }
  };
  const turn = roots.length ? hash01(roots[0].id, 7) * Math.PI * 2 : 0;
  roots.forEach((r, i) => {
    const span = (Math.PI * 2) / roots.length;
    place(r, { a0: turn + i * span, a1: turn + (i + 1) * span, u0: 0, u1: 1 }, null, [0, 1, 0]);
  });
  const mainRoot = nodes[0];

  // Người không có con: treo thành chùm quanh đầu cành của cha (hoặc nhú ra từ thân nếu cha ở trên thân)
  const leafNodes: LayoutNode[] = [];
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (const n of [...nodes]) {
    const lk = leafKids(n.member.id);
    if (!lk.length) continue;
    const d = dirOf.get(n.member.id) || [0, 1, 0];
    const [p1, p2] = basis(d);
    const onSpine = spineDepth.has(n.member.id);
    lk.forEach((k, i) => {
      const h = (s: number) => hash01(k.id, s);
      const phi = GOLDEN * i + h(6) * Math.PI * 2;
      let pos: Vec3;
      if (onSpine) {
        const out = n.woodRadius * 0.9 + 0.9 + 0.35 * h(7);
        const up = 0.45 + 0.4 * h(8);
        pos = [n.position[0] + Math.cos(phi) * out, n.position[1] + up, n.position[2] + Math.sin(phi) * out];
      } else {
        const theta = (30 + 45 * h(7)) * DEG;
        const len = 0.38 + 0.42 * h(8) + 0.035 * Math.min(10, lk.length);
        const side = v3.add(v3.scale(p1, Math.cos(phi)), v3.scale(p2, Math.sin(phi)));
        pos = v3.add(n.position, v3.add(v3.scale(d, len * Math.cos(theta)), v3.scale(side, len * Math.sin(theta))));
        pos[1] -= 0.08;
      }
      const node: LayoutNode = { member: k, position: pos, angle: Math.atan2(pos[2], pos[0]), leaves: 1, isRoot: false, woodRadius: 0 };
      nodes.push(node);
      byId.set(k.id, node);
      leafNodes.push(node);
    });
  }
  const isLeafNode = (n: LayoutNode) => n.woodRadius === 0 && !n.isRoot;

  // ---- Tán giữ trong vòm: mắt cành vượt ra ngoài đường bao ellipsoid thì kéo vào (giữ một phần cho mép tán không phẳng lì)
  const crown = nodes.filter((n) => !spineDepth.has(n.member.id));
  for (const n of crown) {
    let [x, y, z] = n.position;
    // Đỉnh tán bo tròn: vượt quá chiều cao tán thì ép mềm chứ không cắt phẳng
    y = Math.max(1.0, y > CROWN_H ? CROWN_H + (y - CROWN_H) * 0.35 : y);
    const t = y / CROWN_H;
    const env = CROWN_R * Math.sqrt(Math.max(0.1, 1 - Math.pow((t - 0.5) / 0.62, 2)));
    const r = Math.hypot(x, z);
    if (r > env) {
      const nr = env + (r - env) * 0.3;
      x *= nr / r;
      z *= nr / r;
    }
    n.position = [x, y, z];
  }

  // ---- Đẩy các mắt cành, chùm lá quá sát nhau ra (lưới không gian, vài vòng)
  const radiusOfNode = (n: LayoutNode) => (isLeafNode(n) ? 0.2 : 0.32);
  const CELL = 0.65;
  const cell = (p: Vec3) => [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL)];
  for (let iter = 0; iter < 6; iter++) {
    const grid = new Map<string, LayoutNode[]>();
    for (const n of crown) {
      const k = cell(n.position).join(",");
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k)!.push(n);
    }
    let moved = 0;
    for (const n of crown) {
      const [cx, cy, cz] = cell(n.position);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            for (const o of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
              if (o === n || o.member.id < n.member.id) continue;
              const minD = radiusOfNode(n) + radiusOfNode(o);
              const d = v3.sub(o.position, n.position);
              const dist = v3.len(d);
              if (dist >= minD || dist === 0) continue;
              const push = v3.scale(v3.norm([d[0], d[1] * 0.5, d[2]]), (minD - dist) / 2);
              n.position = v3.sub(n.position, push);
              o.position = v3.add(o.position, push);
              moved++;
            }
          }
    }
    if (!moved) break;
  }

  // ---- Cành nhỏ, chùm lá không đâm xuyên cành to: nằm trong "ống" quanh một cành to thì đẩy ra ngoài
  const segDist = (p: Vec3, a: Vec3, b: Vec3) => {
    const ab = v3.sub(b, a);
    const t = clamp(v3.dot(v3.sub(p, a), ab) / (v3.dot(ab, ab) || 1), 0, 1);
    const q = v3.add(a, v3.scale(ab, t));
    return { d: v3.len(v3.sub(p, q)), q };
  };
  const thickSegs = nodes
    .filter((n) => !n.isRoot && n.woodRadius >= 0.16 && parentOf(n.member) && !spineDepth.has(n.member.id))
    .map((n) => ({ a: byId.get(parentOf(n.member)!)!, b: n, r: n.woodRadius }));
  for (let iter = 0; iter < 3; iter++) {
    for (const n of crown) {
      for (const sg of thickSegs) {
        if (n === sg.a || n === sg.b) continue;
        const clear = sg.r * 1.25 + 0.36;
        const { d, q } = segDist(n.position, sg.a.position, sg.b.position);
        if (d >= clear) continue;
        let dir = v3.sub(n.position, q);
        if (v3.len(dir) < 1e-4) dir = [Math.cos(n.angle), 0.3, Math.sin(n.angle)];
        n.position = v3.add(q, v3.scale(v3.norm(dir), clear));
      }
    }
  }
  for (const n of nodes) n.angle = ((Math.atan2(n.position[2], n.position[0]) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // ---- Độ cao và độ xòe đặc trưng của mỗi đời (camera, chip chọn đời)
  const genStats = new Map<number, { sumY: number; n: number; rs: number[] }>();
  for (const n of nodes) {
    const g = n.member.generation;
    if (!genStats.has(g)) genStats.set(g, { sumY: 0, n: 0, rs: [] });
    const st = genStats.get(g)!;
    st.sumY += n.position[1];
    st.n++;
    st.rs.push(Math.hypot(n.position[0], n.position[2]));
  }
  const meanY = new Map<number, number>();
  const spreadByGen = new Map<number, number>();
  let lastY = Number.NEGATIVE_INFINITY;
  for (let g = minGen; g <= maxGen; g++) {
    const st = genStats.get(g);
    const y = st ? st.sumY / st.n : lastY + GEN_HEIGHT;
    lastY = lastY === Number.NEGATIVE_INFINITY ? y : Math.max(y, lastY + 0.2);
    meanY.set(g, lastY);
    if (st) {
      const rs = st.rs.sort((x, y2) => x - y2);
      spreadByGen.set(g, rs[Math.floor(rs.length * 0.9)] ?? rs[rs.length - 1]);
    }
  }
  const heightOf = (gen: number) => meanY.get(gen) ?? (gen - minGen) * GEN_HEIGHT;
  if (mainRoot) mainRoot.woodRadius = trunkTop;

  // ---------------------------------------------------------------- chuỗi gỗ liền mạch
  const chains: LayoutChain[] = [];
  const radiusAt = (n: LayoutNode) => (n.isRoot ? trunkTop : n.woodRadius || TIP_RADIUS);
  const isSpine = (n: LayoutNode) => spineDepth.has(n.member.id);
  /** Số cành con mọc ra tại nút: cành hơi phình (cổ cành); thân chính không phình để không gồ ghề */
  const collarAt = (n: LayoutNode) => (isSpine(n) ? 1 : 1 + 0.04 * Math.min(3, Math.max(0, woodKids(n.member.id).length - 1)));

  /** Điểm uốn giữa hai mắt cành: vồng nhẹ lên và lệch ngang một chút, cành mảnh uốn nhiều hơn */
  const midArc = (a: LayoutNode, b: LayoutNode): Vec3 => {
    const d = v3.sub(b.position, a.position);
    const dist = v3.len(d) || 1;
    const [side] = basis(d);
    const thin = 1 - Math.min(1, radiusAt(b) / 0.35);
    const lift = dist * (0.05 + 0.09 * thin);
    const wobble = (hash01(b.member.id, 3) - 0.5) * dist * (0.05 + 0.14 * thin);
    return v3.add(v3.add(v3.add(a.position, v3.scale(d, 0.5)), [0, lift, 0]), v3.scale(side, wobble));
  };

  /**
   * Ngọn cành: vươn thêm một đoạn ngắn, thon dần và rủ nhẹ xuống như đầu cành non.
   * `short`: nút cuối có chùm người không con treo quanh thì ngọn chỉ vươn 60% để không đâm xuyên chùm
   * (các twig đã nối từng người rồi, ngọn dài trông như một cành thừa không gắn ai).
   */
  const finishTip = (chain: LayoutChain, short = false) => {
    const n = chain.points.length;
    if (n < 2) return;
    const k = short ? 0.6 : 1;
    const dir = v3.norm(v3.sub(chain.points[n - 1], chain.points[n - 2]));
    const flat = v3.norm([dir[0], Math.min(dir[1], 0.15), dir[2]]);
    const last = chain.points[n - 1];
    const g = chain.gens[n - 1];
    chain.points.push(v3.add(last, v3.add(v3.scale(flat, 0.3 * k), [0, -0.04 * k, 0])));
    chain.radii.push(Math.max(TIP_RADIUS * 1.3, chain.radii[n - 1] * 0.55));
    chain.gens.push(g);
    chain.points.push(v3.add(last, v3.add(v3.scale(flat, 0.55 * k), [0, -0.14 * k, 0])));
    chain.radii.push(TIP_RADIUS * 0.75);
    chain.gens.push(g);
  };

  /** Nối tiếp chuỗi từ nút `from` theo dòng chính (con có con nhiều hậu duệ nhất); các con khác thành chuỗi riêng */
  const extend = (chain: LayoutChain, from: LayoutNode, prevPos: Vec3) => {
    let cur = from;
    for (;;) {
      const kids = woodKids(cur.member.id);
      if (!kids.length) break;
      const main = byId.get(kids[0].id)!;
      const tangent = v3.norm(v3.sub(main.position, prevPos));
      for (const k of kids.slice(1)) startSide(cur, byId.get(k.id)!, tangent);
      prevPos = cur.position;
      const rMain = radiusAt(main);
      const rCur = radiusAt(cur);
      chain.points.push(midArc(cur, main));
      chain.radii.push(isSpine(main) ? (rCur + rMain) / 2 : Math.min(rCur, rMain * 1.08));
      chain.gens.push(main.member.generation - 0.5);
      chain.points.push(main.position);
      chain.radii.push(rMain * collarAt(main));
      chain.gens.push(main.member.generation);
      cur = main;
    }
    finishTip(chain, leafKids(cur.member.id).length > 0);
  };

  /**
   * Cành con mọc từ trong lòng cành mẹ tại nút `at`: chạy theo hướng cành mẹ một đoạn ngắn (cổ cành)
   * rồi mới uốn ra phía con, nên chỗ tiếp nối liền như cây thật thay vì hai ống cắt nhau.
   */
  const startSide = (at: LayoutNode, child: LayoutNode, tangent: Vec3) => {
    const rParent = radiusAt(at);
    const rChild = radiusAt(child);
    const r0 = Math.min(rParent * 0.6, rChild * 1.5);
    const r1 = Math.min(rParent * 0.75, rChild * 1.3);
    const toChild = v3.norm(v3.sub(child.position, at.position));
    const lean = v3.norm(v3.add(v3.scale(tangent, 0.55), v3.scale(toChild, 0.45)));
    const collar = v3.add(v3.add(at.position, v3.scale(lean, rParent * 1.1)), [0, rParent * 0.1, 0]);
    const chain: LayoutChain = {
      id: child.member.id,
      kind: "branch",
      points: [at.position, collar, midArc(at, child), child.position],
      radii: [r0, r1, rChild * 1.1, rChild * collarAt(child)],
      gens: [child.member.generation - 0.9, child.member.generation - 0.75, child.member.generation - 0.5, child.member.generation],
      startInside: true,
    };
    chains.push(chain);
    extend(chain, child, at.position);
  };

  /**
   * Cành con mảnh (twig) cho người không có con: mọc từ trong lòng gỗ của cha, hơi vồng, kết thúc ĐÚNG tại nút
   * nên viên ngọc / đỉnh cuống đèn lá luôn đính vào cành. Gọi sau các bước dọn chồng để tới vị trí cuối cùng.
   * Dùng `at.woodRadius` chứ không `radiusAt`: gốc phụ (isRoot) mảnh mà radiusAt trả bán kính thân chính.
   */
  const twig = (at: LayoutNode, leaf: LayoutNode) => {
    const rP = at.woodRadius || TIP_RADIUS;
    const d = v3.sub(leaf.position, at.position);
    const dist = v3.len(d);
    const dir: Vec3 = dist > 1e-3 ? v3.scale(d, 1 / dist) : dirOf.get(at.member.id) || [0, 1, 0];
    // Gốc twig ngay dưới vỏ cha (0.9 bán kính); người quá sát thì lấy nửa đường
    const base = v3.add(at.position, v3.scale(dir, Math.min(rP * 0.9, dist * 0.5)));
    const dd = v3.sub(leaf.position, base);
    const L = v3.len(dd) || 1e-3;
    const [side] = basis(dd);
    const h = (s: number) => hash01(leaf.member.id, s) - 0.5;
    const mid = v3.add(
      v3.add(v3.add(base, v3.scale(dd, 0.5 + h(9) * 0.2)), [0, L * (0.08 + 0.08 * (h(10) + 0.5)), 0]),
      v3.scale(side, h(12) * L * 0.2),
    );
    const r0 = clamp(rP * 0.6, 0.03, 0.08);
    const g = leaf.member.generation;
    chains.push({
      id: `${leaf.member.id}__twig`,
      kind: "twig",
      points: [at.position, base, mid, leaf.position],
      radii: [r0, r0 * 0.9, (r0 + TIP_RADIUS) / 2, TIP_RADIUS * 0.8],
      // Twig mọc xong đúng lúc đèn/đốm hiện (cả hai đủ tại visibleGen = g - 0.5)
      gens: [g - 0.9, g - 0.7, g - 0.4, g],
      startInside: true,
    });
  };

  let rootSpread = 0;
  if (mainRoot) {
    const g0 = minGen - 1;
    const H = mainRoot.position[1] - GROUND_Y;
    const at = (y: number): Vec3 => {
      const [lx, lz] = leanAt(y);
      return [lx, y, lz];
    };
    // Thân: rễ cái cắm xuống, gốc loe, thon dần lên, nghiêng nhẹ một hướng, đi tiếp qua các đời trên thân
    const trunk: LayoutChain = {
      id: "__trunk",
      kind: "trunk",
      points: [[0, GROUND_Y - 3.4, 0], [0, GROUND_Y - 1.5, 0], [0, GROUND_Y - 0.3, 0], at(GROUND_Y + 0.5), at(GROUND_Y + H * 0.35), at(GROUND_Y + H * 0.7), mainRoot.position],
      radii: [0.18, trunkBase * 0.55, trunkBase * 1.0, trunkBase * 0.82, trunkTop * 1.2, trunkTop * 1.08, trunkTop],
      gens: [g0, g0, g0, g0, g0, g0, mainRoot.member.generation],
      startInside: false,
    };
    chains.push(trunk);
    extend(trunk, mainRoot, trunk.points[trunk.points.length - 2]);
    // Các gốc phụ (người không có cha mẹ trong dữ liệu) mọc như cành riêng từ thân ở độ cao của họ
    for (const r of roots) {
      if (r.id === mainRoot.member.id) continue;
      const n = byId.get(r.id)!;
      const fake: LayoutNode = { ...mainRoot, position: at(Math.min(n.position[1] - GEN_HEIGHT * 0.6, mainRoot.position[1])) };
      startSide(fake, n, [0, 1, 0]);
    }
    // Mỗi người không có con một twig nối vào cha (cha trên thân hay ngoài thân đều vậy)
    for (const n of leafNodes) {
      const p = byId.get(parentOf(n.member)!);
      if (p) twig(p, n);
    }
    rootSpread = trunkBase * 1.5;

    // Bộ rễ trong lòng đất: rễ chính tỏa đều quanh gốc, lượn mềm, chúc dần xuống và thon nhỏ;
    // mỗi rễ chính đâm thêm rễ phụ, rễ phụ có rễ con. Nằm hẳn dưới mặt đất nên chỉ thấy khi nhìn từ dưới lên.
    const below = (p: Vec3): Vec3 => [p[0], Math.min(p[1], GROUND_Y - 0.1), p[2]];
    const rootLine = (id: string, start: Vec3, az: number, len: number, r0: number, drop: number, curl: number, steps: number) => {
      const pts: Vec3[] = [];
      const radii: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const a = az + curl * Math.sin(s * 2.6 + hash01(id, 21) * 6);
        const out = len * s;
        const y = start[1] - drop * Math.pow(s, 1.25) - 0.25 * Math.sin(s * Math.PI) * hash01(id, 22);
        pts.push(below([start[0] + Math.cos(a) * out, y, start[2] + Math.sin(a) * out]));
        radii.push(Math.max(0.025, r0 * Math.pow(1 - s, 1.35) + 0.02));
      }
      chains.push({ id, kind: "root", points: pts, radii, gens: pts.map(() => g0), startInside: true });
      return { pts, radii };
    };
    const MAIN_ROOTS = 9;
    for (let i = 0; i < MAIN_ROOTS; i++) {
      const id = `__root${i}`;
      const az = (i / MAIN_ROOTS) * Math.PI * 2 + (hash01(id, 1) - 0.5) * 0.5;
      const len = CROWN_R * (0.42 + 0.28 * hash01(id, 2));
      const start: Vec3 = [Math.cos(az) * trunkBase * 0.35, GROUND_Y - 0.25, Math.sin(az) * trunkBase * 0.35];
      const main = rootLine(id, start, az, len, trunkBase * 0.42, len * (0.22 + 0.18 * hash01(id, 3)), 0.22, 9);
      const laterals = 2 + Math.floor(hash01(id, 4) * 3);
      for (let k = 0; k < laterals; k++) {
        const lid = `${id}_${k}`;
        const atI = Math.min(main.pts.length - 2, 2 + Math.floor(((k + 0.5) / laterals) * (main.pts.length - 3)));
        const side = (k % 2 ? 1 : -1) * (0.55 + 0.5 * hash01(lid, 5));
        const llen = len * (0.32 + 0.22 * hash01(lid, 6)) * (1 - (atI / main.pts.length) * 0.5);
        const lat = rootLine(lid, main.pts[atI], az + side, llen, main.radii[atI] * 0.55, llen * 0.35, 0.3, 6);
        const tip = lat.pts[Math.min(lat.pts.length - 2, 3)];
        rootLine(`${lid}_t`, tip, az + side * 1.6, llen * 0.45, lat.radii[3] * 0.6, llen * 0.25, 0.4, 4);
      }
    }
  }

  let crownR = 1;
  for (const r of spreadByGen.values()) crownR = Math.max(crownR, r);
  return {
    nodes,
    byId,
    chains,
    minGen,
    maxGen,
    heightOf,
    spreadOf: (gen: number) => Math.max(gen === minGen ? trunkTop : 0.5, spreadByGen.get(gen) ?? 1),
    groundY: GROUND_Y,
    trunk: { baseRadius: trunkBase, topRadius: trunkTop, topY: mainRoot ? mainRoot.position[1] : 0, rootSpread },
    crown: { height: CROWN_H, radius: crownR },
  };
}
