import type { FamilyEvent } from "../types";
import { formatLunar, lunarMonthLength, lunarToSolar, solarToLunar } from "./lunar.ts";

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Nửa đêm (giờ máy) của ngày lịch cách `d` n ngày. Không cộng n × 24 giờ: ngày đổi giờ mùa hè
 * chỉ dài 23 hoặc 25 giờ, cộng 24 giờ sẽ lấn sang ngày kế tiếp hoặc hụt mất một giờ.
 */
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const withTime = (day: Date, time: Date) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());

export const isLunarEvent = (e: Pick<FamilyEvent, "calendar" | "lunar">) => e.calendar === "lunar" && !!e.lunar;

/**
 * Ngày dương của sự kiện âm lịch lặp lại trong năm âm lịch `year`.
 * Tháng nhuận được làm vào tháng thường; ngày 30 gặp tháng thiếu thì làm ngày 29 (cuối tháng).
 */
function lunarYearOccurrence(e: FamilyEvent, year: number): Date | null {
  const { day, month } = e.lunar!;
  // Năm gốc giữ đúng ngày admin đã chọn (kể cả tháng nhuận)
  if (year === e.lunar!.year) return startOfDay(new Date(e.date));
  const len = lunarMonthLength(year, month);
  if (!len) return null;
  return lunarToSolar({ day: Math.min(day, len), month, year });
}

/** Ngày dương lịch lặp lại trong năm `year` (29/2 gặp năm thường thì làm 28/2) */
function solarYearOccurrence(base: Date, year: number): Date {
  const lastDay = new Date(year, base.getMonth() + 1, 0).getDate();
  return new Date(year, base.getMonth(), Math.min(base.getDate(), lastDay));
}

/** Các lần diễn ra trong khoảng [from, to), sắp theo thời gian */
export function occurrencesBetween(e: FamilyEvent, from: Date, to: Date): Date[] {
  const base = new Date(e.date);
  if (Number.isNaN(base.getTime())) return [];
  if (!e.recurring) return base >= from && base < to ? [base] : [];

  const out: Date[] = [];
  const firstDay = startOfDay(base);
  for (let y = from.getFullYear() - 1; y <= to.getFullYear(); y++) {
    const day = isLunarEvent(e) ? lunarYearOccurrence(e, y) : solarYearOccurrence(base, y);
    if (!day || day < firstDay) continue;
    const at = withTime(day, base);
    if (at >= from && at < to) out.push(at);
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** Có diễn ra vào ngày (theo giờ máy) chứa `day` không */
export const occursOn = (e: FamilyEvent, day: Date) => {
  const from = startOfDay(day);
  return occurrencesBetween(e, from, addDays(from, 1)).length > 0;
};

/** Lần diễn ra kế tiếp kể từ đầu ngày hôm nay; null nếu sự kiện một lần đã qua */
export function nextOccurrence(e: FamilyEvent, now = new Date()): Date | null {
  const from = startOfDay(now);
  return occurrencesBetween(e, from, new Date(from.getFullYear() + 2, from.getMonth(), from.getDate()))[0] ?? null;
}

/** Ngày nên hiển thị: lần kế tiếp, hoặc ngày gốc nếu sự kiện một lần đã qua */
export const displayOccurrence = (e: FamilyEvent, now = new Date()) => nextOccurrence(e, now) ?? new Date(e.date);

const dmy = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

/** "Nhằm ngày 26/4/2026 Dương lịch" */
export const solarNote = (d: Date) => `Nhằm ngày ${dmy(d)} Dương lịch`;

/** "Tức mùng 10 tháng 3 năm Bính Ngọ Âm lịch" */
export const lunarNote = (d: Date) => {
  const text = formatLunar(solarToLunar(d));
  return `Tức ${text.charAt(0).toLowerCase()}${text.slice(1)} Âm lịch`;
};

/**
 * Dòng chính và dòng chú thích cho một lần diễn ra:
 * sự kiện âm lịch → ngày âm làm chính, chú thích ngày dương; sự kiện dương lịch thì ngược lại.
 * `formatSolar` để mỗi trang giữ cách viết ngày dương sẵn có.
 */
export function describeOccurrence(
  e: FamilyEvent,
  occ: Date,
  formatSolar: (d: Date) => string
): { primary: string; secondary: string } {
  if (isLunarEvent(e)) return { primary: formatLunar(solarToLunar(occ)), secondary: solarNote(occ) };
  return { primary: formatSolar(occ), secondary: lunarNote(occ) };
}
