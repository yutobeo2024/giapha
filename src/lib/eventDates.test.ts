// Chạy: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FamilyEvent } from "../types";
import { describeOccurrence, nextOccurrence, occurrencesBetween, occursOn } from "./eventDates.ts";
import { lunarMonthLength, lunarToSolar, type LunarDate } from "./lunar.ts";

const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);

function lunarEvent(lunar: LunarDate, recurring = true, hour = 8): FamilyEvent {
  const day = lunarToSolar(lunar)!;
  day.setHours(hour, 30);
  return { id: "e", title: "Giỗ", type: "Kỵ nhật", calendar: "lunar", lunar, recurring, date: day.toISOString() };
}

test("giỗ âm lịch lặp hằng năm: lần kế tiếp theo năm âm", () => {
  const e = lunarEvent({ day: 10, month: 3, year: 2023 });
  assert.equal(ymd(nextOccurrence(e, new Date(2024, 0, 1))), "2024-4-18");
  assert.equal(ymd(nextOccurrence(e, new Date(2024, 3, 18, 23))), "2024-4-18", "hôm nay vẫn tính");
  assert.equal(ymd(nextOccurrence(e, new Date(2024, 3, 19))), "2025-4-7");
  // Giữ giờ của sự kiện gốc
  const next = nextOccurrence(e, new Date(2024, 0, 1))!;
  assert.equal(`${next.getHours()}:${next.getMinutes()}`, "8:30");
  // Không có lần nào trước năm gốc
  assert.deepEqual(occurrencesBetween(e, new Date(2020, 0, 1), new Date(2023, 0, 1)), []);
  assert.equal(occursOn(e, new Date(2025, 3, 7)), true);
  assert.equal(occursOn(e, new Date(2025, 3, 8)), false);
});

test("giỗ tháng nhuận: năm gốc đúng tháng nhuận, năm sau làm tháng thường", () => {
  const e = lunarEvent({ day: 5, month: 6, year: 2025, leap: true });
  assert.equal(ymd(nextOccurrence(e, new Date(2025, 6, 1))), ymd(lunarToSolar({ day: 5, month: 6, year: 2025, leap: true })));
  assert.equal(ymd(nextOccurrence(e, new Date(2025, 8, 1))), ymd(lunarToSolar({ day: 5, month: 6, year: 2026 })));
});

test("giỗ ngày 30 gặp tháng thiếu thì làm ngày cuối tháng", () => {
  // Tìm một tháng 30 ngày có tháng cùng số năm sau chỉ 29 ngày
  let y = 2026;
  let m = 1;
  search: for (y = 2026; y < 2040; y++)
    for (m = 1; m <= 12; m++) if (lunarMonthLength(y, m) === 30 && lunarMonthLength(y + 1, m) === 29) break search;
  const e = lunarEvent({ day: 30, month: m, year: y });
  const next = nextOccurrence(e, new Date(y + 1, 0, 1));
  const expected = lunarToSolar({ day: 29, month: m, year: y + 1 });
  // Tháng 11, 12 có thể rơi sang năm dương sau nữa
  const within = occurrencesBetween(e, new Date(y + 1, 0, 1), new Date(y + 3, 0, 1)).map(ymd);
  assert.ok(within.includes(ymd(expected)), `${m}/${y + 1}: ${within.join(", ")} có ${ymd(expected)}; next=${ymd(next)}`);
});

test("sự kiện dương lịch", () => {
  const once: FamilyEvent = { id: "a", title: "Họp họ", type: "Hội họp", date: new Date(2026, 3, 1, 9).toISOString() };
  assert.equal(nextOccurrence(once, new Date(2026, 4, 1)), null, "một lần, đã qua");
  assert.equal(ymd(nextOccurrence(once, new Date(2026, 0, 1))), "2026-4-1");

  const leapDay: FamilyEvent = { ...once, recurring: true, date: new Date(2024, 1, 29, 9).toISOString() };
  assert.equal(ymd(nextOccurrence(leapDay, new Date(2025, 0, 1))), "2025-2-28");
  assert.equal(ymd(nextOccurrence(leapDay, new Date(2027, 2, 1))), "2028-2-29");
});

test("dòng chính và chú thích", () => {
  const e = lunarEvent({ day: 10, month: 3, year: 2024 });
  const occ = new Date(2024, 3, 18, 8, 30);
  assert.deepEqual(describeOccurrence(e, occ, () => "x"), {
    primary: "Mùng 10 tháng 3 năm Giáp Thìn",
    secondary: "Nhằm ngày 18/4/2024 Dương lịch",
  });
  const solar: FamilyEvent = { id: "s", title: "Họp", type: "Hội họp", date: occ.toISOString() };
  assert.deepEqual(describeOccurrence(solar, occ, () => "18 tháng 4 2024"), {
    primary: "18 tháng 4 2024",
    secondary: "Tức mùng 10 tháng 3 năm Giáp Thìn Âm lịch",
  });
});
