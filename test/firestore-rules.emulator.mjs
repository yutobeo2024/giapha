// Thử firestore.rules trên Firestore Emulator. Chạy: npm run test:rules (cần Java).
// Emulator nhận token không ký (alg none), nên tự tạo được mọi loại tài khoản.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const P = "demo-giapha";
const DB = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8")).firestore.database;
const HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const BASE = `http://${HOST}/v1/projects/${P}/databases/${DB}/documents`;
const run = randomUUID().slice(0, 8);

function token(uid, { email = `${uid}@example.test`, name, verified = true } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${P}`, aud: P, sub: uid, user_id: uid, auth_time: now, iat: now, exp: now + 3600,
    email, email_verified: verified, ...(name ? { name } : {}),
  })}.`;
}

/** Đổi giá trị JS sang dạng REST của Firestore; Date → timestamp, số nguyên → integer */
function enc(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  throw new Error(`không hỗ trợ ${v}`);
}

/** PATCH ghi đè cả document (như setDoc); mask = chỉ sửa các trường đó (như updateDoc / setDoc merge) */
async function write(path, fields, who, mask) {
  const q = mask ? "?" + mask.map((f) => `updateMask.fieldPaths=${f}`).join("&") : "";
  const r = await fetch(`${BASE}/${path}${q}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${who}` } : {}) },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, enc(x)])) }),
  });
  return r.status;
}
async function remove(path, who) {
  return (await fetch(`${BASE}/${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${who}` } })).status;
}

const OWNER = "owner";
const uid = (k) => `${k}-${run}`;
const as = (k, opts) => token(uid(k), opts);
const superAdmin = token(uid("super"), { email: "hanhtoami@gmail.com", name: "Hạnh" });

test("chuẩn bị tài khoản", async () => {
  for (const [k, role] of [["admin", "admin"], ["admin2", "admin"], ["editor", "editor"], ["victim", "user"]]) {
    assert.equal(await write(`users/${uid(k)}`, { role, isLocked: false, email: `${uid(k)}@example.test` }, OWNER), 200);
  }
});

test("hồ sơ người dùng: tạo và cập nhật như app (useAuth) vẫn được", async () => {
  const me = as("newbie", { name: "Nguyễn Văn Mới" });
  const now = new Date();
  assert.equal(
    await write(`users/${uid("newbie")}`, {
      email: `${uid("newbie")}@example.test`, displayName: "Nguyễn Văn Mới", photoURL: null,
      role: "user", isLocked: false, createdAt: now, lastLogin: now,
    }, me),
    200,
  );
  // Lần đăng nhập sau: setDoc merge lastLogin, photoURL, displayName
  assert.equal(
    await write(`users/${uid("newbie")}`, { lastLogin: now, photoURL: "https://lh3.googleusercontent.com/a/x", displayName: "Nguyễn Văn Mới" }, me, ["lastLogin", "photoURL", "displayName"]),
    200,
  );
  assert.equal(
    await write(`users/${uid("super")}`, { email: "hanhtoami@gmail.com", displayName: "Hạnh", role: "admin", isLocked: false, createdAt: now, lastLogin: now }, superAdmin),
    200,
    "super admin tự tạo hồ sơ admin",
  );
});

test("hồ sơ người dùng: không giả email, không phình, không thêm trường lạ", async () => {
  const me = as("stranger");
  const base = { role: "user", isLocked: false, email: `${uid("stranger")}@example.test` };
  assert.equal(await write(`users/${uid("stranger")}`, { ...base, email: "nguoi-than@gmail.com" }, me), 403, "email người khác");
  assert.equal(await write(`users/${uid("stranger")}`, { ...base, displayName: "x".repeat(101) }, me), 403, "tên quá dài");
  assert.equal(await write(`users/${uid("stranger")}`, { ...base, note: "x" }, me), 403, "trường lạ");
  assert.equal(await write(`users/${uid("stranger")}`, base, me), 200);
  assert.equal(await write(`users/${uid("stranger")}`, { email: "khac@gmail.com" }, me, ["email"]), 403, "đổi email sau khi tạo");
  assert.equal(await write(`users/${uid("stranger")}`, { displayName: "x".repeat(500000) }, me, ["displayName"]), 403, "đổi tên dài");
  assert.equal(await write(`users/${uid("stranger")}`, { role: "editor" }, me, ["role"]), 403, "tự nâng quyền");
});

test("xóa hồ sơ người dùng: chỉ super admin", async () => {
  assert.equal(await remove(`users/${uid("admin2")}`, as("admin")), 403, "admin thường xóa admin khác");
  assert.equal(await remove(`users/${uid("victim")}`, as("admin")), 403, "admin thường xóa người dùng");
  assert.equal(await remove(`users/${uid("victim")}`, superAdmin), 200);
});

test("admin vẫn duyệt và khóa được người dùng (updateDoc role/isLocked)", async () => {
  assert.equal(await write(`users/${uid("stranger")}`, { role: "editor" }, as("admin"), ["role"]), 200);
  assert.equal(await write(`users/${uid("stranger")}`, { isLocked: true }, as("admin"), ["isLocked"]), 200);
  assert.equal(await write(`users/${uid("admin2")}`, { role: "editor" }, as("admin"), ["role"]), 403, "admin thường hạ admin khác");
});

test("thành viên: biểu mẫu Quản trị đủ trường vẫn lưu được, kể cả document dạng dữ liệu thật", async () => {
  const full = {
    name: "Nguyễn Nhuận A", gender: "Nam", generation: 12, birthDate: "12/05/1980", deathDate: "Kỵ 16-9 ÂL",
    branch: "Chi 2 - Xóm Đông", role: "Trưởng chi", biography: "x".repeat(5000), fatherId: "Ab_c-123", motherId: "Xy9",
    spouse: "Lê Thị B", address: "Thôn Đông", photoUrl: "/api/photos/members/a.jpg", status: "Deceased",
  };
  assert.equal(await write(`members/full-${run}`, full, as("editor")), 200);
  const live = { status: "Alive", gender: "Nữ", biography: "y".repeat(341), name: "Nguyễn Thị C", branch: "Chi 3", fatherId: "x".repeat(27), generation: 21, spouse: "z" };
  assert.equal(await write(`members/live-${run}`, live, as("editor")), 200);
});

test("thành viên: chặn kiểu sai, số đời vô lý, trường lạ, chuỗi quá dài", async () => {
  const ok = { name: "A", gender: "Nam", generation: 2 };
  const cases = [
    [{ ...ok, generation: 1000000000 }, "đời 1 tỷ"],
    [{ ...ok, generation: 2.5 }, "đời 2,5"],
    [{ ...ok, generation: 0 }, "đời 0"],
    [{ ...ok, fatherId: 12345 }, "fatherId là số"],
    [{ ...ok, fatherId: "../users/x" }, "fatherId có ký tự lạ"],
    [{ ...ok, bio: "x" }, "trường lạ"],
    [{ ...ok, biography: "x".repeat(20001) }, "tiểu sử quá dài"],
    [{ ...ok, spouse: "x".repeat(501) }, "vợ/chồng quá dài"],
    [{ ...ok, photoUrl: "data:image/jpeg;base64," + "x".repeat(3000) }, "ảnh nhúng base64"],
  ];
  for (const [fields, label] of cases) assert.equal(await write(`members/bad-${run}`, fields, as("editor")), 403, label);
});

test("sự kiện: âm lịch/dương lịch như app vẫn lưu được; ngày sai, trường lạ bị chặn", async () => {
  const lunar = {
    title: "Giỗ tổ", type: "Kỵ nhật", calendar: "lunar", lunar: { day: 1, month: 12, year: 2026, leap: true },
    recurring: true, date: "2027-01-08T01:00:00.000Z", location: "Nhà thờ họ", description: "Họp họ", memberId: "Ab_c-123",
  };
  assert.equal(await write(`events/ok-${run}`, lunar, as("editor")), 200);
  assert.equal(await write(`events/ok2-${run}`, { title: "Họp", type: "Hội họp", recurring: false, date: "2026-10-17T00:00:00Z" }, as("editor")), 200);
  const cases = [
    [{ ...lunar, date: "2026-13-99T99:99:99xyz" }, "ngày vô lý"],
    [{ ...lunar, date: "2026-10-17T00:00:00" }, "thiếu Z"],
    [{ ...lunar, lunar: { day: 31, month: 1, year: 2026 } }, "ngày âm 31"],
    [{ ...lunar, lunar: { day: 1, month: 1, year: 2026, x: 1 } }, "ngày âm có trường lạ"],
    [{ ...lunar, calendar: "julian" }, "lịch lạ"],
    [{ ...lunar, description: "x".repeat(5001) }, "mô tả quá dài"],
    [{ ...lunar, extra: "x" }, "trường lạ"],
  ];
  for (const [fields, label] of cases) assert.equal(await write(`events/bad-${run}`, fields, as("editor")), 403, label);
});

test("nhật ký: chỉ ghi dưới tên/email của chính mình, nội dung có giới hạn", async () => {
  const named = as("editor", { name: "Nguyễn Biên Tập" });
  const row = { userName: "Nguyễn Biên Tập", userPhoto: "https://lh3.googleusercontent.com/a/x", action: "đã thêm mới thành viên: A", timestamp: new Date().toISOString() };
  assert.equal(await write(`activities/a-${run}`, row, named), 200, "tên Google");
  assert.equal(await write(`activities/b-${run}`, { ...row, userName: `${uid("editor")}@example.test`, userPhoto: null }, as("editor")), 200, "không có tên thì dùng email");
  assert.equal(await write(`activities/c-${run}`, { ...row, userName: "hanhtoami@gmail.com" }, named), 403, "mạo danh");
  assert.equal(await write(`activities/d-${run}`, { ...row, action: "x".repeat(501) }, named), 403, "nội dung quá dài");
  assert.equal(await write(`activities/e-${run}`, { ...row, extra: "x" }, named), 403, "trường lạ");
});

test("bài viết: ngày tạo/sửa dạng toISOString vẫn lưu được", async () => {
  const now = new Date().toISOString();
  const post = { title: "Tin họ", kind: "article", published: true, content: "<p>a</p>", createdAt: now, updatedAt: now, pinned: false, eventDate: now.slice(0, 10) };
  assert.equal(await write(`posts/p-${run}`, post, superAdmin), 200);
});
