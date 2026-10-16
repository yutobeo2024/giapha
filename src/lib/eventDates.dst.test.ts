// Chạy: npm test. Người xem ở nơi có đổi giờ mùa hè (Mỹ, châu Âu): ngày đổi giờ chỉ dài 23 hoặc 25 giờ.
// Mỗi file test chạy trong một tiến trình riêng nên đổi múi giờ ở đây không ảnh hưởng file khác.
process.env.TZ = "America/New_York";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { FamilyEvent } from "../types";
import { addDays, occursOn } from "./eventDates.ts";

test("múi giờ đang thử là New York", () => {
  // 8/3/2026 là ngày đổi sang giờ mùa hè: dài 23 giờ
  assert.equal(new Date(2026, 2, 9).getTime() - new Date(2026, 2, 8).getTime(), 23 * 3600_000);
});

test("addDays trả về nửa đêm ngày lịch kế tiếp, kể cả ngày đổi giờ", () => {
  const next = addDays(new Date(2026, 2, 8, 0, 0), 1);
  assert.deepEqual([next.getDate(), next.getHours()], [9, 0]);
  const back = addDays(new Date(2026, 10, 1), 1); // 1/11/2026: dài 25 giờ
  assert.deepEqual([back.getDate(), back.getHours()], [2, 0]);
});

test("sự kiện 00:30 ngày 9/3 chỉ thuộc ngày 9/3, không lấn sang 8/3", () => {
  const e: FamilyEvent = { id: "x", title: "x", type: "Khác", date: new Date(2026, 2, 9, 0, 30).toISOString() };
  assert.equal(occursOn(e, new Date(2026, 2, 8)), false);
  assert.equal(occursOn(e, new Date(2026, 2, 9)), true);
});

test("sự kiện 23:30 ngày 1/11 (ngày dài 25 giờ) vẫn thuộc ngày 1/11", () => {
  const e: FamilyEvent = { id: "y", title: "y", type: "Khác", date: new Date(2026, 10, 1, 23, 30).toISOString() };
  assert.equal(occursOn(e, new Date(2026, 10, 1)), true);
  assert.equal(occursOn(e, new Date(2026, 10, 2)), false);
});
