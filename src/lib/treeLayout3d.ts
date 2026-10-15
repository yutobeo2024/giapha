import type { FamilyMember } from "../types";

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

export type ChainKind = "trunk" | "branch";

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
}

/** Khoảng cách dọc tham chiếu giữa hai đời (camera dùng để chừa lề) */
export const GEN_HEIGHT = 1.5;
/** Bán kính đầu cành (ngọn thon) */
export const TIP_RADIUS = 0.04;
/** Bán kính thân ở chỗ chia cành, cố định để cây không phình to khi gia phả thêm người */
const TRUNK_TOP_RADIUS = 1.35;
const TRUNK_FLARE = 1.9;

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
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};

/**
 * Tính bố cục cây 3D kiểu cây thật: Thủy tổ ở đỉnh thân, mỗi người là một mắt cành mọc ra từ cành của cha;
 * nhánh gánh nhiều hậu duệ thì to, đi thẳng và dài; nhánh ít hậu duệ thì mảnh, tách ra góc lớn.
 * Sau đó co giãn tán thành vòm tròn và nối các mắt cành thành chuỗi gỗ liền mạch.
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

  const roots = members.filter((m) => !parentOf(m)).sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, "vi"));
  const minGen = members.length ? Math.min(...members.map((m) => m.generation)) : 1;
  const maxGen = members.length ? Math.max(...members.map((m) => m.generation)) : 1;

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
  const rootLeaves = Math.max(1, ...roots.map((r) => leavesOf(r.id)));
  const kidsByLeaves = (id: string) =>
    [...(children.get(id) || [])].sort((a, b) => leavesOf(b.id) - leavesOf(a.id) || a.name.localeCompare(b.name, "vi"));

  // Độ sâu còn lại phía dưới mỗi người (số đời con cháu nối tiếp dài nhất)
  const restMemo = new Map<string, number>();
  const restOf = (id: string): number => {
    if (restMemo.has(id)) return restMemo.get(id)!;
    const kids = children.get(id) || [];
    const v = kids.length ? 1 + Math.max(...kids.map((k) => restOf(k.id))) : 0;
    restMemo.set(id, v);
    return v;
  };

  /**
   * Tán như cây sồi cổ thụ: cành cái tỏa ra từ đỉnh thân, phủ kín một vòm tròn.
   * Mỗi người nhận một "ô" trên vòm (khoảng góc quanh thân × khoảng độ cao) tỉ lệ với số con cháu,
   * ô của cha được chia cho các con theo chiều dài hơn, chỗ chia lệch ngẫu nhiên ổn định theo id.
   * Người đứng ở hướng giữa ô, càng nhiều đời con cháu phía sau thì càng gần đỉnh thân.
   */
  const E_MIN = 4 * DEG;
  const E_MAX = 84 * DEG;
  type Cell = { a0: number; a1: number; u0: number; u1: number };
  const elevOf = (u: number) => Math.asin(Math.sin(E_MIN) + (Math.sin(E_MAX) - Math.sin(E_MIN)) * u);
  const place = (m: FamilyMember, cell: Cell, depth: number, isRoot: boolean) => {
    const hasKids = (children.get(m.id) || []).length > 0;
    const j = (salt: number) => hash01(m.id, salt) - 0.5;
    const a = (cell.a0 + cell.a1) / 2 + j(1) * (cell.a1 - cell.a0) * 0.35;
    const u = clamp((cell.u0 + cell.u1) / 2 + j(2) * (cell.u1 - cell.u0) * 0.35, 0, 1);
    // Ô càng lớn (nhánh gánh càng nhiều hậu duệ) thì càng vươn thẳng lên như thân, cành cái; ô nhỏ mới ngả theo hướng ô
    const big = clamp(((cell.a1 - cell.a0) / (Math.PI * 2)) * (cell.u1 - cell.u0) * 2.2, 0, 1);
    const e = elevOf(u) + (88 * DEG - elevOf(u)) * Math.pow(big, 0.7);
    // Khoảng cách từ đỉnh thân: theo phần đường đã đi trên dòng của mình, lẫn theo số đời (để các đời không thành lớp)
    const rest = restOf(m.id);
    const frac = depth === 0 ? 0 : 0.55 * (depth / (depth + rest)) + 0.45 * Math.min(1, depth / Math.max(1, maxGen - minGen));
    const rho = depth === 0 ? 0 : Math.pow(frac, 0.85) * (1 + j(3) * 0.22);
    const ce = Math.cos(e);
    const pos: Vec3 = [ce * Math.cos(a) * rho, Math.sin(e) * rho, ce * Math.sin(a) * rho];
    const node: LayoutNode = {
      member: m,
      position: pos,
      angle: a,
      leaves: leavesOf(m.id),
      isRoot,
      woodRadius: hasKids ? pipeRadiusOf(leavesOf(m.id), rootLeaves) : 0,
    };
    nodes.push(node);
    byId.set(m.id, node);

    // Chia ô cho các con: con đông hậu duệ ở giữa, con ít hậu duệ xen hai bên
    const sorted = kidsByLeaves(m.id);
    const kids: FamilyMember[] = [];
    sorted.forEach((k, i) => (i % 2 ? kids.push(k) : kids.unshift(k)));
    const total = kids.reduce((s, k) => s + Math.pow(leavesOf(k.id), 0.92), 0) || 1;
    const midE = elevOf((cell.u0 + cell.u1) / 2);
    const widthA = (cell.a1 - cell.a0) * Math.cos(midE);
    const widthU = (elevOf(cell.u1) - elevOf(cell.u0)) * 1.1;
    // Ô hẹp thì chia theo chiều dài hơn; lệch thêm theo độ sâu để các tầng xen kẽ
    const byAzimuth = depth === 0 || widthA * (0.8 + 0.4 * hash01(m.id, 4)) >= widthU;
    let cursor = 0;
    for (const k of kids) {
      const w = Math.pow(leavesOf(k.id), 0.92) / total;
      // Lấn sang ô bên cạnh một chút để đường chia không thẳng tắp
      const wobble = (hash01(k.id, 5) - 0.5) * w * 0.25;
      const f0 = cursor;
      const f1 = Math.min(1, cursor + w + wobble);
      cursor = f1;
      const sub: Cell = byAzimuth
        ? { a0: cell.a0 + (cell.a1 - cell.a0) * f0, a1: cell.a0 + (cell.a1 - cell.a0) * f1, u0: cell.u0, u1: cell.u1 }
        : { a0: cell.a0, a1: cell.a1, u0: cell.u0 + (cell.u1 - cell.u0) * f0, u1: cell.u0 + (cell.u1 - cell.u0) * f1 };
      place(k, sub, depth + 1, false);
    }
  };
  const turn = roots.length ? hash01(roots[0].id, 7) * Math.PI * 2 : 0;
  roots.forEach((r, i) => {
    const span = (Math.PI * 2) / roots.length;
    place(r, { a0: turn + i * span, a1: turn + (i + 1) * span, u0: 0, u1: 1 }, i === 0 ? 0 : 1, true);
  });
  const mainRoot = nodes[0];

  // ---- Tỉ lệ theo dáng cây sồi: tán rộng hơn cao, thân chừng một phần ba chiều cao cả cây
  const genSpan = Math.max(1, maxGen - minGen);
  const CROWN_H = 4 + 0.7 * genSpan;
  const CROWN_R = 1.05 * CROWN_H;
  const crown = nodes.filter((n) => n !== mainRoot);
  for (const n of crown) {
    const [x, y, z] = n.position;
    // Gốc tán hơi nâng lên: cành cái vươn xiên lên rồi mới xòe
    const out = Math.hypot(x, z);
    // Cành cái vươn xiên lên khỏi đỉnh thân rồi mới xòe: tán ngồi trên thân như cây sồi
    n.position = [x * CROWN_R, y * CROWN_H * 0.95 + Math.min(1, out * 2.2) * CROWN_H * 0.22, z * CROWN_R];
  }

  // ---- Đẩy các mắt cành quá sát nhau ra (lưới không gian, vài vòng)
  const MIN_D = 0.62;
  const cell = (p: Vec3) => [Math.floor(p[0] / MIN_D), Math.floor(p[1] / MIN_D), Math.floor(p[2] / MIN_D)];
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
              const d = v3.sub(o.position, n.position);
              const dist = v3.len(d);
              if (dist >= MIN_D || dist === 0) continue;
              const push = v3.scale(v3.norm([d[0], d[1] * 0.4, d[2]]), (MIN_D - dist) / 2);
              n.position = v3.sub(n.position, push);
              o.position = v3.add(o.position, push);
              moved++;
            }
          }
    }
    if (!moved) break;
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

  // Thân chính: thon và cao, loe ở gốc
  const trunkTop = TRUNK_TOP_RADIUS;
  const trunkBase = trunkTop * TRUNK_FLARE;
  const GROUND_Y = -Math.max(5, 0.72 * CROWN_H);
  if (mainRoot) mainRoot.woodRadius = trunkTop;

  // ---------------------------------------------------------------- chuỗi gỗ liền mạch
  const chains: LayoutChain[] = [];
  const radiusAt = (n: LayoutNode) => (n.isRoot ? trunkTop : n.woodRadius || TIP_RADIUS);
  /** Số cành con mọc ra tại nút: thân hơi phình (cổ cành) như cây thật */
  const collarAt = (n: LayoutNode) => 1 + 0.05 * Math.min(3, Math.max(0, (children.get(n.member.id) || []).length - 1));

  /** Điểm uốn giữa hai nút: vồng lên rồi tỏa ra, lệch ngang một chút (cành mảnh uốn nhiều hơn) */
  const midPoint = (a: LayoutNode, b: LayoutNode): Vec3 => {
    const d = v3.sub(b.position, a.position);
    const dist = v3.len(d) || 1;
    const side = v3.norm(v3.cross(d, [0, 1, 0]));
    const thin = 1 - Math.min(1, radiusAt(b) / 0.4);
    const lift = dist * (0.1 + 0.16 * thin);
    const wobble = (hash01(b.member.id, 3) - 0.5) * dist * (0.12 + 0.3 * thin);
    return v3.add(v3.add(v3.add(a.position, v3.scale(d, 0.5)), [0, lift, 0]), v3.scale(side, wobble));
  };

  /** Nối tiếp chuỗi từ nút `from` theo dòng chính (con nhiều hậu duệ nhất); các con khác thành chuỗi riêng */
  const extend = (chain: LayoutChain, from: LayoutNode, prevPos: Vec3) => {
    let cur = from;
    for (;;) {
      const kids = kidsByLeaves(cur.member.id);
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
    const r0 = Math.min(rParent * 0.6, leaf ? 0.1 : rChild * 1.5);
    const r1 = Math.min(rParent * 0.75, leaf ? 0.09 : rChild * 1.3);
    const rMid = leaf ? 0.07 : rChild * 1.1;
    const rEnd = leaf ? rChild : rChild * collarAt(child);
    const toChild = v3.norm(v3.sub(child.position, at.position));
    const lean = v3.norm(v3.add(v3.scale(tangent, 0.55), v3.scale(toChild, 0.45)));
    const collar = v3.add(v3.add(at.position, v3.scale(lean, rParent * 1.1)), [0, rParent * 0.1, 0]);
    const chain: LayoutChain = {
      id: child.member.id,
      kind: "branch",
      points: [at.position, collar],
      radii: [r0, r1],
      gens: [child.member.generation - 0.9, child.member.generation - 0.75],
      startInside: true,
    };
    chain.points.push(midPoint(at, child));
    chain.radii.push(rMid);
    chain.gens.push(child.member.generation - 0.5);
    chain.points.push(child.position);
    chain.radii.push(rEnd);
    chain.gens.push(child.member.generation);
    chains.push(chain);
    extend(chain, child, at.position);
  };

  let rootSpread = 0;
  if (mainRoot) {
    const [rx, ry, rz] = mainRoot.position;
    const g0 = minGen - 1;
    const H = ry - GROUND_Y;
    // Thân hơi uốn chữ S, nghiêng nhẹ theo hướng ngẫu nhiên ổn định, loe mạnh ở gốc
    const lean = hash01(mainRoot.member.id, 11) * Math.PI * 2;
    const sway = (k: number): Vec3 => [Math.cos(lean) * k, 0, Math.sin(lean) * k];
    const trunk: LayoutChain = {
      id: "__trunk",
      kind: "trunk",
      points: [
        [0, GROUND_Y - 0.4, 0],
        [0, GROUND_Y + 0.5, 0],
        v3.add([0, GROUND_Y + H * 0.22, 0], sway(0.12)),
        v3.add([0, GROUND_Y + H * 0.5, 0], sway(0.35)),
        v3.add([rx * 0.4, GROUND_Y + H * 0.78, rz * 0.4], sway(0.18)),
        [rx, ry, rz],
      ],
      radii: [trunkBase * 1.05, trunkBase * 0.82, trunkTop * 1.22, trunkTop * 1.1, trunkTop * 1.03, trunkTop],
      gens: [g0, g0, g0, g0, g0, mainRoot.member.generation],
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
    rootSpread = trunkBase * 1.5;
  }

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
  };
}
