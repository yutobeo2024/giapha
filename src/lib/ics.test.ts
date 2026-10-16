// Chạy: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FamilyEvent } from "../types";
import { buildIcs, icsUid } from "./ics.ts";
import { occurrencesBetween } from "./eventDates.ts";
import { lunarToSolar } from "./lunar.ts";

const uidOf = (ics: string) => /^UID:(.*)$/m.exec(ics)![1];

test("giỗ âm lịch rơi hai lần trong một năm dương thì mỗi lần một UID", () => {
  const first = lunarToSolar({ day: 1, month: 12, year: 2025 })!;
  first.setHours(9);
  const e: FamilyEvent = {
    id: "gio-cu",
    title: "Giỗ cụ",
    type: "Kỵ nhật",
    recurring: true,
    calendar: "lunar",
    lunar: { day: 1, month: 12, year: 2025 },
    date: first.toISOString(),
  };
  const occ = occurrencesBetween(e, new Date(2027, 0, 1), new Date(2028, 0, 1));
  assert.equal(occ.length, 2, "mùng 1 tháng Chạp: 08/01 và 28/12/2027");
  const uids = occ.map((d) => uidOf(buildIcs(e, d)));
  assert.notEqual(uids[0], uids[1]);
  assert.match(uids[0], /^gio-cu-2027010\d@giapha-nguyen-nhuan$/);
});

test("sự kiện một lần giữ UID là id; id lạ không chèn được dòng mới vào file", () => {
  const e: FamilyEvent = { id: "abc", title: "Họp họ", type: "Hội họp", date: "2026-10-14T02:00:00Z" };
  assert.equal(icsUid(e, new Date(e.date)), "abc@giapha-nguyen-nhuan");
  const bad = buildIcs({ ...e, id: "a\r\nATTENDEE:mailto:x@y", description: "một\r\nATTENDEE:bad" });
  assert.ok(!/\r\nATTENDEE/.test(bad));
  assert.equal(bad.split("\r\n").filter((l) => l.startsWith("UID:")).length, 1);
});
