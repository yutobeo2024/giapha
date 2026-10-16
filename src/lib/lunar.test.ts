// Chạy: npm test (node --test, Node ≥ 22 tự bỏ kiểu TypeScript)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  solarToLunar,
  lunarToSolar,
  isValidLunarDate,
  lunarMonthLength,
  leapMonthOfYear,
  canChiYear,
  formatLunar,
} from "./lunar.ts";

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test("Tết Nguyên đán theo giờ Việt Nam", () => {
  const tet: Array<[number, string]> = [
    [2026, "2026-2-17"],
    [2025, "2025-1-29"],
    [2024, "2024-2-10"],
    [2023, "2023-1-22"],
    [2020, "2020-1-25"],
    // Hai năm Tết Việt Nam lệch Tết Trung Quốc (UTC+8)
    [2007, "2007-2-17"],
    [1985, "1985-1-21"],
  ];
  for (const [year, expected] of tet) {
    assert.equal(ymd(lunarToSolar({ day: 1, month: 1, year })!), expected, `Tết ${year}`);
    const [y, m, d] = expected.split("-").map(Number);
    assert.deepEqual(solarToLunar(new Date(y, m - 1, d)), { day: 1, month: 1, year, leap: false });
  }
});

test("ngày lịch sử đã biết", () => {
  // 2/9/1945 tức 26/7 Ất Dậu
  assert.deepEqual(solarToLunar(new Date(1945, 8, 2)), { day: 26, month: 7, year: 1945, leap: false });
  // Giỗ Tổ Hùng Vương 10/3 âm (ngày nghỉ lễ): 29/4/2023, 18/4/2024, 7/4/2025
  assert.equal(ymd(lunarToSolar({ day: 10, month: 3, year: 2023 })!), "2023-4-29");
  assert.equal(ymd(lunarToSolar({ day: 10, month: 3, year: 2024 })!), "2024-4-18");
  assert.equal(ymd(lunarToSolar({ day: 10, month: 3, year: 2025 })!), "2025-4-7");
  // Ngày liền trước Tết thuộc năm âm lịch trước: 16/2/2026 là ngày cuối tháng Chạp Ất Tỵ
  assert.deepEqual(solarToLunar(new Date(2026, 1, 16)), {
    day: lunarMonthLength(2025, 12),
    month: 12,
    year: 2025,
    leap: false,
  });
});

test("tháng nhuận", () => {
  assert.equal(leapMonthOfYear(2025), 6);
  assert.equal(leapMonthOfYear(2023), 2);
  assert.equal(leapMonthOfYear(2020), 4);
  assert.equal(leapMonthOfYear(2026), 0);
  assert.equal(leapMonthOfYear(2024), 0);
  // Mùng 1 tháng 6 nhuận Ất Tỵ là 25/7/2025, tháng 6 thường bắt đầu 25/6/2025
  assert.equal(ymd(lunarToSolar({ day: 1, month: 6, year: 2025, leap: true })!), "2025-7-25");
  assert.equal(ymd(lunarToSolar({ day: 1, month: 6, year: 2025 })!), "2025-6-25");
  assert.deepEqual(solarToLunar(new Date(2025, 6, 25)), { day: 1, month: 6, year: 2025, leap: true });
  // Năm không có tháng nhuận thì ngày "nhuận" không tồn tại
  assert.equal(lunarToSolar({ day: 1, month: 6, year: 2026, leap: true }), null);
});

test("độ dài tháng và kiểm tra ngày hợp lệ", () => {
  for (let y = 2020; y <= 2030; y++) {
    for (let m = 1; m <= 12; m++) {
      const len = lunarMonthLength(y, m, false);
      assert.ok(len === 29 || len === 30, `${m}/${y} dài ${len}`);
      assert.ok(isValidLunarDate({ day: len, month: m, year: y }));
      assert.equal(isValidLunarDate({ day: len + 1, month: m, year: y }), false);
    }
  }
  assert.equal(isValidLunarDate({ day: 0, month: 1, year: 2026 }), false);
  assert.equal(isValidLunarDate({ day: 1, month: 13, year: 2026 }), false);
});

test("đi vòng dương → âm → dương khớp từng ngày 2019–2031", () => {
  const d = new Date(2019, 0, 1);
  while (d.getFullYear() < 2032) {
    const l = solarToLunar(d);
    assert.equal(ymd(lunarToSolar(l)!), ymd(d));
    d.setDate(d.getDate() + 1);
  }
});

test("can chi và cách đọc", () => {
  assert.equal(canChiYear(2026), "Bính Ngọ");
  assert.equal(canChiYear(2025), "Ất Tỵ");
  assert.equal(canChiYear(1945), "Ất Dậu");
  assert.equal(formatLunar({ day: 10, month: 3, year: 2026 }), "Mùng 10 tháng 3 năm Bính Ngọ");
  assert.equal(formatLunar({ day: 15, month: 1, year: 2026 }), "Ngày 15 tháng Giêng năm Bính Ngọ");
  assert.equal(formatLunar({ day: 23, month: 12, year: 2025 }), "Ngày 23 tháng Chạp năm Ất Tỵ");
  assert.equal(formatLunar({ day: 2, month: 6, year: 2025, leap: true }), "Mùng 2 tháng 6 nhuận năm Ất Tỵ");
});
