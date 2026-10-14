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
  /** Bán kính gỗ tại nút (0 nếu là đầu cành) để đặt viên ngọc trên vỏ */
  woodRadius: number;
}

export type ChainKind = "trunk" | "branch" | "buttress" | "rootlet";

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
  /** Độ cao y của mỗi đời */
  heightOf: (gen: number) => number;
  /** Bán kính tán lớn nhất ở mỗi đời (để đặt camera) */
  spreadOf: (gen: number) => number;
  groundY: number;
  /** Thân chính: bán kính ở gốc (đã loe) và ở đỉnh (chỗ chia cành), độ cao đỉnh, độ lan của rễ */
  trunk: { baseRadius: number; topRadius: number; topY: number; rootSpread: number };
}

/** Khoảng cách dọc giữa hai đời */
export const GEN_HEIGHT = 1.5;
/** Mặt đất thấp hơn Thủy tổ để có thân trụ cao, gốc loe và rễ bạnh */
const GROUND_Y = -5.0;
/** Bán kính đầu cành (ngọn thon) */
export const TIP_RADIUS = 0.04;

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

const v3 = {
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};

/**
 * Tính bố cục cây 3D kiểu "sunburst quanh thân":
 * mỗi nút nhận một cung góc tỉ lệ với số lá trong nhánh của nó, đặt ở giữa cung,
 * độ cao theo đời, bán kính tăng dần theo đời; rồi nối thành các chuỗi gỗ liền mạch.
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

  // ---------------------------------------------------------------- chuỗi gỗ liền mạch
  const chains: LayoutChain[] = [];
  const kidsSorted = (id: string) => [...(children.get(id) || [])].sort((a, b) => leavesOf(b.id) - leavesOf(a.id));
  const radiusAt = (n: LayoutNode) => (n.isRoot ? trunkTop : n.woodRadius || TIP_RADIUS);
  /** Số cành con mọc ra tại nút: thân hơi phình (cổ cành) như cây thật */
  const collarAt = (n: LayoutNode) => 1 + 0.05 * Math.min(3, Math.max(0, (children.get(n.member.id) || []).length - 1));

  /** Điểm uốn giữa hai nút: vồng lên rồi tỏa ra, lệch ngang một chút cho tự nhiên (cành mảnh uốn nhiều hơn) */
  const midPoint = (a: LayoutNode, b: LayoutNode): Vec3 => {
    const d = v3.sub(b.position, a.position);
    const dist = v3.len(d) || 1;
    const side = v3.norm(v3.cross(d, [0, 1, 0]));
    const thin = 1 - Math.min(1, radiusAt(b) / 0.6);
    // Cành mảnh vồng lên và lượn ngang nhiều hơn để không thành que thẳng
    const lift = GEN_HEIGHT * (0.28 + 0.22 * thin) + dist * 0.08 * thin;
    const wobble = (hash01(b.member.id, 3) - 0.5) * dist * (0.1 + 0.34 * thin);
    return v3.add(v3.add(v3.add(a.position, v3.scale(d, 0.5)), [0, lift, 0]), v3.scale(side, wobble));
  };

  /** Nối tiếp chuỗi từ nút `from` theo dòng chính (con nhiều hậu duệ nhất); các con khác thành chuỗi riêng */
  const extend = (chain: LayoutChain, from: LayoutNode, prevPos: Vec3) => {
    let cur = from;
    for (;;) {
      const kids = kidsSorted(cur.member.id);
      if (!kids.length) break;
      const main = byId.get(kids[0].id)!;
      // Hướng cành mẹ tại nút: từ nút trước tới con chính
      const tangent = v3.norm(v3.sub(main.position, prevPos));
      for (const k of kids.slice(1)) startSide(cur, byId.get(k.id)!, tangent);
      prevPos = cur.position;
      const leaf = !(children.get(main.member.id) || []).length;
      const rMain = radiusAt(main);
      chain.points.push(midPoint(cur, main));
      chain.radii.push(leaf ? Math.max(TIP_RADIUS * 1.8, radiusAt(cur) * 0.45) : rMain * 1.08);
      chain.gens.push(main.member.generation - 0.5);
      chain.points.push(main.position);
      chain.radii.push(leaf ? TIP_RADIUS * 1.35 : rMain * collarAt(main));
      chain.gens.push(main.member.generation);
      cur = main;
    }
    // Ngọn thon nhọn vươn thêm một đoạn ngắn theo hướng cũ
    const n = chain.points.length;
    if (n >= 2) {
      const dir = v3.norm(v3.sub(chain.points[n - 1], chain.points[n - 2]));
      chain.points.push(v3.add(chain.points[n - 1], v3.add(v3.scale(dir, 0.05), [0, 0.02, 0])));
      chain.radii.push(TIP_RADIUS);
      chain.gens.push(chain.gens[n - 1]);
    }
  };

  /**
   * Cành con mọc từ trong lòng cành mẹ tại nút `at`: chạy theo hướng cành mẹ một đoạn ngắn (cổ cành)
   * rồi mới uốn ra phía con, nên chỗ tiếp nối liền như cây thật thay vì hai ống cắt nhau.
   */
  const startSide = (at: LayoutNode, child: LayoutNode, tangent: Vec3) => {
    const rParent = radiusAt(at);
    const leaf = !(children.get(child.member.id) || []).length;
    const rChild = leaf ? TIP_RADIUS * 1.35 : radiusAt(child);
    const toChild = v3.norm(v3.sub(child.position, at.position));
    const lean = v3.norm(v3.add(v3.scale(tangent, 0.6), v3.scale(toChild, 0.4)));
    const collar = v3.add(v3.add(at.position, v3.scale(lean, rParent * 1.1)), [0, rParent * 0.1, 0]);
    const chain: LayoutChain = {
      id: child.member.id,
      kind: "branch",
      points: [at.position, collar],
      radii: [Math.min(rParent * 0.6, leaf ? 0.12 : rChild * 1.5), Math.min(rParent * 0.75, leaf ? 0.11 : rChild * 1.35)],
      gens: [child.member.generation - 0.9, child.member.generation - 0.75],
      startInside: true,
    };
    chain.points.push(midPoint(at, child));
    chain.radii.push(leaf ? 0.085 : rChild * 1.12);
    chain.gens.push(child.member.generation - 0.5);
    chain.points.push(child.position);
    chain.radii.push(leaf ? rChild : rChild * collarAt(child));
    chain.gens.push(child.member.generation);
    chains.push(chain);
    extend(chain, child, at.position);
  };

  let rootSpread = 0;
  if (mainRoot) {
    const [rx, ry, rz] = mainRoot.position;
    const g0 = minGen - 1;
    // Thân: loe mạnh ở gốc, thon dần lên đỉnh rồi chạy tiếp theo dòng chính
    const trunk: LayoutChain = {
      id: "__trunk",
      kind: "trunk",
      points: [
        [0, GROUND_Y - 0.4, 0],
        [0, GROUND_Y + 0.5, 0],
        [0, GROUND_Y + 1.6, 0],
        [rx * 0.25, GROUND_Y + 3.2, rz * 0.25],
        [rx, ry, rz],
      ],
      radii: [trunkBase * 1.05, trunkBase * 0.86, trunkTop * 1.22, trunkTop * 1.08, trunkTop],
      gens: [g0, g0, g0, g0, mainRoot.member.generation],
      startInside: false,
    };
    chains.push(trunk);
    extend(trunk, mainRoot, trunk.points[trunk.points.length - 2]);
    // Các gốc phụ (người không có cha mẹ trong dữ liệu) mọc như cành riêng từ thân ở độ cao của họ
    for (const r of roots) {
      if (r.id === mainRoot.member.id) continue;
      const n = byId.get(r.id)!;
      const fake: LayoutNode = { ...mainRoot, position: [0, Math.min(n.position[1] - GEN_HEIGHT * 0.6, mainRoot.position[1]), 0] };
      startSide(fake, n, [0, 1, 0]);
    }

    // Rễ bạnh lan trên mặt đất + rễ con rẽ nhánh (mọc từ trong gốc nên không cần nắp)
    const BUTTRESSES = 8;
    for (let i = 0; i < BUTTRESSES; i++) {
      const a = (i / BUTTRESSES) * Math.PI * 2 + 0.3 + (hash01("ba" + i) - 0.5) * 0.35;
      const len = 3.6 + hash01("root" + i) * 2.0;
      rootSpread = Math.max(rootSpread, len);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const bend = (hash01("bend" + i) - 0.5) * 0.9;
      chains.push({
        id: "__root" + i,
        kind: "buttress",
        points: [
          [ca * trunkTop * 0.5, GROUND_Y + 1.25, sa * trunkTop * 0.5],
          [ca * trunkBase * 0.98, GROUND_Y + 0.42, sa * trunkBase * 0.98],
          [Math.cos(a + bend * 0.3) * len * 0.55, GROUND_Y + 0.03, Math.sin(a + bend * 0.3) * len * 0.55],
          [Math.cos(a + bend * 0.5) * len, GROUND_Y - 0.12, Math.sin(a + bend * 0.5) * len],
        ],
        radii: [trunkTop * 0.6, trunkTop * 0.46, trunkTop * 0.2, 0.05],
        gens: [g0, g0, g0, g0],
        startInside: true,
      });
      const subs = 1 + (hash01("subn" + i) > 0.45 ? 1 : 0);
      for (let s = 0; s < subs; s++) {
        const side = s === 0 ? 1 : -1;
        const sa2 = a + side * (0.5 + hash01("suba" + i + s) * 0.35);
        const t0 = 0.4 + hash01("subt" + i + s) * 0.2;
        const start: Vec3 = [Math.cos(a + bend * 0.2) * len * t0, GROUND_Y + 0.05, Math.sin(a + bend * 0.2) * len * t0];
        const sl = len * (0.35 + hash01("subl" + i + s) * 0.3);
        chains.push({
          id: `__rootlet${i}_${s}`,
          kind: "rootlet",
          points: [
            start,
            [start[0] + Math.cos(sa2) * sl * 0.4, GROUND_Y - 0.02, start[2] + Math.sin(sa2) * sl * 0.4],
            [start[0] + Math.cos(sa2) * sl, GROUND_Y - 0.15, start[2] + Math.sin(sa2) * sl],
          ],
          radii: [trunkTop * 0.15, trunkTop * 0.08, 0.03],
          gens: [g0, g0, g0],
          startInside: true,
        });
      }
    }
  }

  return {
    nodes,
    byId,
    chains,
    minGen,
    maxGen,
    heightOf,
    spreadOf: (gen: number) => Math.max(gen === minGen ? trunkTop : 0, spreadByGen.get(gen) ?? radiusFor(gen - minGen)),
    groundY: GROUND_Y,
    trunk: { baseRadius: trunkBase, topRadius: trunkTop, topY: mainRoot ? mainRoot.position[1] : 0, rootSpread },
  };
}
