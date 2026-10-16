/**
 * Xuất sơ đồ cây ra PDF khổ A3 bằng cách vẽ thẳng từ dữ liệu (không chụp màn hình):
 * chữ nét khi in, tìm được tên trong file, file nhẹ, không vượt giới hạn canvas của điện thoại.
 * Nhánh quá rộng thì chia nhiều tờ, cắt đúng ranh giới ô/đời để in rồi ghép lại.
 */
import type { jsPDF as JsPDF } from "jspdf";
import type { FamilyMember } from "../types";
import { CARD_H, CARD_W, GAP_Y, ROW, SLOT, layoutTree, planPages, type LaidNode, type PagePlan, A3 } from "./treeLayout.ts";

const FONT = "BeVietnamPro";
const SITE = "giaphanguyennhuan.com";
const C = {
  text: "#2D2A26",
  muted: "#8A857D",
  red: "#8B2323",
  line: "#B8B2A6",
  border: "#D9D4C9",
  male: "#60A5FA",
  female: "#F472B6",
  dead: "#374151",
};

let fontCache: Promise<{ regular: string; bold: string }> | null = null;

async function fetchFontBase64(file: string): Promise<string> {
  const res = await fetch(`/fonts/${file}`);
  if (!res.ok) throw new Error(`Không tải được font ${file} (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Font tiếng Việt (Be Vietnam Pro, giấy phép OFL) chỉ tải khi xuất, giữ lại cho các lần sau */
function loadFonts() {
  fontCache ??= Promise.all([fetchFontBase64("BeVietnamPro-Regular.ttf"), fetchFontBase64("BeVietnamPro-Bold.ttf")])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((e) => {
      fontCache = null;
      throw e;
    });
  return fontCache;
}

export interface TreePdfOptions {
  roots: FamilyMember[];
  /** Các con được in */
  shown: (m: FamilyMember) => FamilyMember[];
  /** Tổng số con (để ghi "+N con" ở nhánh không in hết) */
  total?: (m: FamilyMember) => number;
  /** Dòng phụ dưới tiêu đề, vd "Nhánh của …" */
  subtitle: string;
  fileName: string;
  /** Hỏi trước khi xuất file nhiều tờ; trả false để hủy */
  confirmPages?: (pages: number, plan: PagePlan) => boolean;
}

/** Trả về số tờ đã xuất, hoặc 0 nếu người dùng hủy */
export async function exportTreePdf(opts: TreePdfOptions): Promise<number> {
  const layout = layoutTree(opts.roots, opts.shown, opts.total);
  const plan = planPages(layout.slots, layout.depths);
  const pages = plan.cols * plan.rows;
  if (opts.confirmPages && !opts.confirmPages(pages, plan)) return 0;

  const [{ jsPDF }, fonts] = await Promise.all([import("jspdf"), loadFonts()]);
  const doc = new jsPDF({ orientation: plan.orientation, unit: "mm", format: "a3", compress: true });
  doc.addFileToVFS(`${FONT}-Regular.ttf`, fonts.regular);
  doc.addFont(`${FONT}-Regular.ttf`, FONT, "normal");
  doc.addFileToVFS(`${FONT}-Bold.ttf`, fonts.bold);
  doc.addFont(`${FONT}-Bold.ttf`, FONT, "bold");
  doc.setProperties({ title: `Gia phả họ Nguyễn Nhuận – ${opts.subtitle}`, creator: SITE });

  const people = layout.nodes.length;
  const gens = layout.nodes.map((n) => n.item.generation);
  const genText = gens.length ? `đời ${Math.min(...gens)}–${Math.max(...gens)}` : "";
  const today = new Date().toLocaleDateString("vi-VN");
  const s = plan.scale;
  const contentW = layout.slots * SLOT - (SLOT - CARD_W);
  const contentH = layout.depths * ROW - GAP_Y;
  // Một tờ theo chiều nào thì canh giữa theo chiều đó
  const padX = plan.cols === 1 ? (plan.areaW - contentW * s) / 2 - ((SLOT - CARD_W) / 2) * s : 0;
  const padY = plan.rows === 1 ? (plan.areaH - contentH * s) / 2 : 0;

  for (let r = 0; r < plan.rows; r++) {
    for (let c = 0; c < plan.cols; c++) {
      const index = r * plan.cols + c;
      if (index > 0) doc.addPage("a3", plan.orientation);
      const ox = c * plan.slotsPerPage * SLOT;
      const oy = r * plan.depthsPerPage * ROW;
      const X = (x: number) => A3.side + padX + (x - ox) * s;
      const Y = (y: number) => A3.top + padY + (y - oy) * s;

      drawFrame(doc, plan, { index, r, c, pages, subtitle: `${opts.subtitle} · ${people} người · ${genText}`, today });

      doc.saveGraphicsState();
      doc.rect(A3.side, A3.top, plan.areaW, plan.areaH, null);
      doc.clip();
      doc.discardPath();
      const minX = ox - SLOT;
      const maxX = ox + (plan.areaW / s) + SLOT;
      const minY = oy - ROW;
      const maxY = oy + plan.areaH / s + ROW;
      for (const node of layout.nodes) {
        const cx = (node.x + 0.5) * SLOT;
        const top = node.depth * ROW;
        const lastX = node.children.length ? (node.children[node.children.length - 1].x + 0.5) * SLOT : cx;
        const firstX = node.children.length ? (node.children[0].x + 0.5) * SLOT : cx;
        if (lastX < minX || firstX > maxX || top > maxY || top + ROW + CARD_H < minY) continue;
        drawConnectors(doc, node, X, Y, s);
        if (cx >= minX && cx <= maxX && top >= minY && top <= maxY) drawCard(doc, node, X(cx - CARD_W / 2), Y(top), s);
      }
      doc.restoreGraphicsState();
    }
  }

  doc.save(opts.fileName);
  return pages;
}

function drawConnectors(doc: JsPDF, node: LaidNode<FamilyMember>, X: (x: number) => number, Y: (y: number) => number, s: number) {
  if (!node.children.length) return;
  const cx = (node.x + 0.5) * SLOT;
  const bottom = node.depth * ROW + CARD_H;
  const mid = bottom + GAP_Y / 2;
  doc.setDrawColor(C.line);
  doc.setLineWidth(0.35 * s);
  doc.line(X(cx), Y(bottom), X(cx), Y(mid));
  const xs = node.children.map((ch) => (ch.x + 0.5) * SLOT);
  if (xs.length > 1) doc.line(X(xs[0]), Y(mid), X(xs[xs.length - 1]), Y(mid));
  for (const x of xs) doc.line(X(x), Y(mid), X(x), Y(bottom + GAP_Y));
}

function drawCard(doc: JsPDF, node: LaidNode<FamilyMember>, x: number, y: number, s: number) {
  const m = node.item;
  const w = CARD_W * s;
  const h = CARD_H * s;
  doc.setFillColor("#FFFFFF");
  doc.setDrawColor(C.border);
  doc.setLineWidth(0.25 * s);
  doc.roundedRect(x, y, w, h, 1.2 * s, 1.2 * s, "FD");
  // Vạch màu trên đầu thẻ: xanh = nam, hồng = nữ
  doc.setFillColor(m.gender === "Nữ" ? C.female : C.male);
  doc.rect(x + 1.2 * s, y, w - 2.4 * s, 0.8 * s, "F");
  if (m.status === "Deceased") {
    doc.setFillColor(C.dead);
    doc.circle(x + w - 1.8 * s, y + 2.2 * s, 0.7 * s, "F");
  }

  // Tên: tối đa 3 dòng, dài hơn thì cắt bằng "…"
  const namePt = 7.5 * s;
  doc.setFont(FONT, "bold");
  doc.setFontSize(namePt);
  doc.setTextColor(C.text);
  let lines: string[] = doc.splitTextToSize(m.name, w - 2 * s);
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    let last = lines[2];
    while (last && doc.getTextWidth(last + "…") > w - 2 * s) last = last.slice(0, -1);
    lines[2] = last.trimEnd() + "…";
  }
  const lineH = namePt * 0.3528 * 1.18;
  const nameTop = y + 2.2 * s + ((3 - lines.length) * lineH) / 2;
  lines.forEach((line, i) => doc.text(line, x + w / 2, nameTop + lineH * (i + 0.8), { align: "center" }));

  doc.setFont(FONT, "normal");
  doc.setFontSize(6 * s);
  doc.setTextColor(C.red);
  doc.text(`Đời ${m.generation}`, x + w / 2, y + h - 1.8 * s, { align: "center" });

  if (node.hidden > 0) {
    doc.setFontSize(5.5 * s);
    doc.setTextColor(C.muted);
    doc.text(`+${node.hidden} con`, x + w / 2, y + h + 2.6 * s, { align: "center" });
  }
}

function drawFrame(
  doc: JsPDF,
  plan: PagePlan,
  info: { index: number; r: number; c: number; pages: number; subtitle: string; today: string }
) {
  const right = plan.pageW - A3.side;
  doc.setFont(FONT, "bold");
  doc.setFontSize(13);
  doc.setTextColor(C.red);
  doc.text("GIA PHẢ HỌ NGUYỄN NHUẬN", A3.side, 8.5);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(C.muted);
  doc.text(info.subtitle, A3.side, 13);
  if (info.pages > 1) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(C.text);
    doc.text(`Tờ ${info.index + 1}/${info.pages}`, right, 8.5, { align: "right" });
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(C.muted);
    doc.text(`hàng ${info.r + 1}, cột ${info.c + 1}`, right, 13, { align: "right" });
  }

  const footY = plan.pageH - 4.5;
  doc.setFontSize(7);
  doc.setTextColor(C.muted);
  doc.text(`${SITE} · xuất ngày ${info.today} · vạch xanh: nam, vạch hồng: nữ, chấm đen: đã mất`, A3.side, footY);

  // Sơ đồ ghép tờ: ô tô đậm là tờ đang xem
  if (info.pages > 1) {
    const cell = Math.min(3, 60 / plan.cols, 7 / plan.rows);
    const gx = right - cell * plan.cols;
    const gy = plan.pageH - A3.bottom + 2.5;
    doc.setDrawColor(C.muted);
    doc.setLineWidth(0.15);
    for (let r = 0; r < plan.rows; r++)
      for (let c = 0; c < plan.cols; c++) {
        const cur = r === info.r && c === info.c;
        doc.setFillColor(cur ? C.red : "#FFFFFF");
        doc.rect(gx + c * cell, gy + r * cell, cell, cell, "FD");
      }
    doc.setFontSize(7);
    doc.text("Ghép tờ:", gx - 1.5, footY, { align: "right" });
  }
}

/** Tên file không dấu: "Nguyễn Văn Đức" → "Nguyen-Van-Duc" */
export function slugName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, (ch) => (ch === "đ" ? "d" : "D"))
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "nhanh"
  );
}
