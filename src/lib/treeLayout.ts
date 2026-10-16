/**
 * Dàn sơ đồ cây để in PDF (thuần tính toán, không phụ thuộc trình duyệt).
 * Mỗi lá chiếm một ô ngang, cha nằm giữa con đầu và con cuối; mỗi đời một hàng.
 * Đơn vị: mm ở tỉ lệ 1 (trước khi phóng/thu cho vừa khổ giấy).
 */

export const CARD_W = 17;
export const CARD_H = 17;
/** Bề ngang một ô = thẻ + khoảng cách giữa hai thẻ */
export const SLOT = 20;
/** Khoảng trống giữa hai đời, chỗ vẽ đường nối */
export const GAP_Y = 9;
export const ROW = CARD_H + GAP_Y;

/** Chữ nhỏ nhất chấp nhận khi in (tỉ lệ 0,8: tên 6pt) và lớn nhất cho nhánh nhỏ */
export const MIN_SCALE = 0.8;
export const MAX_SCALE = 1.6;

export interface Paper {
  /** Khổ giấy (mm) theo chiều đứng: A3 = 297 × 420 */
  width: number;
  height: number;
  /** Lề trái/phải, lề trên (chỗ tiêu đề), lề dưới (chỗ chú thích) */
  side: number;
  top: number;
  bottom: number;
}

export const A3: Paper = { width: 297, height: 420, side: 10, top: 16, bottom: 12 };

export interface LaidNode<T> {
  item: T;
  /** Đời tính từ gốc của bản in (0 = hàng trên cùng) */
  depth: number;
  /** Tâm thẻ, tính theo ô (0 = giữa ô đầu tiên) */
  x: number;
  children: LaidNode<T>[];
  /** Số con không in (nhánh đang thu gọn trên màn hình) */
  hidden: number;
}

export interface TreeLayout<T> {
  roots: LaidNode<T>[];
  nodes: LaidNode<T>[];
  /** Số ô ngang và số đời */
  slots: number;
  depths: number;
}

/**
 * Dàn cây. `shown(item)` trả các con được in, `total(item)` tổng số con (để ghi "+N con" khi nhánh thu gọn).
 * Gặp vòng lặp trong dữ liệu (một người là tổ tiên của chính mình) thì cắt ở lần gặp lại.
 */
export function layoutTree<T extends { id: string }>(
  roots: T[],
  shown: (item: T) => T[],
  total: (item: T) => number = (item) => shown(item).length
): TreeLayout<T> {
  const nodes: LaidNode<T>[] = [];
  const seen = new Set<string>();
  let next = 0;
  let depths = 0;

  const place = (item: T, depth: number): LaidNode<T> => {
    seen.add(item.id);
    depths = Math.max(depths, depth + 1);
    const kids = shown(item).filter((c) => !seen.has(c.id));
    const node: LaidNode<T> = { item, depth, x: 0, children: [], hidden: Math.max(0, total(item) - kids.length) };
    nodes.push(node);
    if (kids.length === 0) {
      node.x = next++;
    } else {
      node.children = kids.map((c) => place(c, depth + 1));
      node.x = (node.children[0].x + node.children[node.children.length - 1].x) / 2;
    }
    return node;
  };

  const laidRoots = roots.filter((r) => !seen.has(r.id)).map((r) => place(r, 0));
  return { roots: laidRoots, nodes, slots: next, depths };
}

export interface PagePlan {
  orientation: "landscape" | "portrait";
  /** Kích thước tờ giấy theo hướng đã chọn (mm) */
  pageW: number;
  pageH: number;
  /** Vùng in (mm) */
  areaW: number;
  areaH: number;
  scale: number;
  cols: number;
  rows: number;
  /** Mỗi tờ chứa bao nhiêu ô ngang / bao nhiêu đời; tờ cắt đúng ranh giới ô và ranh giới đời */
  slotsPerPage: number;
  depthsPerPage: number;
}

const contentH = (depths: number) => depths * ROW - GAP_Y;

/**
 * Chọn hướng giấy, tỉ lệ và cách chia tờ: ít tờ nhất mà chữ không nhỏ hơn MIN_SCALE;
 * cùng số tờ thì chọn hướng cho chữ to hơn.
 */
export function planPages(slots: number, depths: number, paper: Paper = A3): PagePlan {
  slots = Math.max(1, slots);
  depths = Math.max(1, depths);
  const options = (["landscape", "portrait"] as const).map((orientation): PagePlan => {
    const pageW = orientation === "landscape" ? paper.height : paper.width;
    const pageH = orientation === "landscape" ? paper.width : paper.height;
    const areaW = pageW - 2 * paper.side;
    const areaH = pageH - paper.top - paper.bottom;
    const fitSlots = Math.max(1, Math.floor(areaW / (SLOT * MIN_SCALE)));
    const cols = Math.ceil(slots / fitSlots);
    // Nhiều tờ theo chiều dọc thì mỗi tờ gồm cả khoảng nối xuống đời đầu của tờ dưới
    const rows = contentH(depths) * MIN_SCALE <= areaH ? 1 : Math.ceil(depths / Math.max(1, Math.floor(areaH / (ROW * MIN_SCALE))));
    // Chia đều cho các tờ rồi phóng to hết mức còn vừa
    const slotsPerPage = Math.ceil(slots / cols);
    const depthsPerPage = Math.ceil(depths / rows);
    const pageContentH = rows === 1 ? contentH(depthsPerPage) : depthsPerPage * ROW;
    const scale = Math.min(MAX_SCALE, areaW / (slotsPerPage * SLOT), areaH / pageContentH);
    return { orientation, pageW, pageH, areaW, areaH, scale, cols, rows, slotsPerPage, depthsPerPage };
  });
  options.sort((a, b) => a.cols * a.rows - b.cols * b.rows || b.scale - a.scale);
  return options[0];
}
