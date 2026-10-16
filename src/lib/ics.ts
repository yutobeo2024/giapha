import type { FamilyEvent } from "../types";
import { describeOccurrence, isLunarEvent } from "./eventDates.ts";

const pad = (n: number) => String(n).padStart(2, "0");

/** Chuyển Date sang định dạng UTC của iCalendar: 20260314T090000Z */
function toIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Thoát ký tự đặc biệt theo RFC 5545 */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * UID riêng cho từng lần diễn ra. Sự kiện lặp lại ghi theo ngày (UTC) của lần đó chứ không theo năm,
 * vì giỗ âm lịch có năm dương rơi hai lần (mùng 1 tháng Chạp: 08/01 và 28/12/2027).
 * Chỉ giữ ký tự an toàn của id để không chèn được dòng mới vào file.
 */
export function icsUid(event: Pick<FamilyEvent, "id" | "recurring">, start: Date): string {
  const id = event.id.replace(/[^A-Za-z0-9_-]/g, "-");
  return `${id}${event.recurring ? `-${toIcsDate(start).slice(0, 8)}` : ""}@giapha-nguyen-nhuan`;
}

/**
 * Tạo nội dung file .ics cho một lần diễn ra của sự kiện (mặc định kéo dài 2 giờ).
 * Lịch điện thoại không lặp được theo âm lịch nên chỉ xuất lần `start`, ghi kèm ngày âm trong mô tả.
 */
export function buildIcs(event: FamilyEvent, start = new Date(event.date)): string {
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const { primary, secondary } = describeOccurrence(event, start, (d) => d.toLocaleDateString("vi-VN"));
  const dateNote = isLunarEvent(event) ? `${primary} (Âm lịch)` : secondary;
  const description = [dateNote, event.description].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gia Pha Nguyen Nhuan//VI",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${icsUid(event, start)}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeText(`[${event.type}] ${event.title}`)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  lines.push(`DESCRIPTION:${escapeText(description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Tải file .ics về máy người dùng. */
export function downloadIcs(event: FamilyEvent, start?: Date): void {
  const blob = new Blob([buildIcs(event, start)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "su-kien"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
