#!/usr/bin/env node
/**
 * Nạp một đợt bài viết trang Thông tin (thư mục content/posts/<đợt>/) lên site thật.
 *
 *   node scripts/import-posts.mjs content/posts/2026-10-dot-2 [--apply] [--overwrite]
 *
 * Thư mục đợt gồm:
 *   posts.json   danh sách [{ id, data }], data theo đúng trường của collection `posts`
 *   images/      ảnh của các bài, tải lên R2 bucket giapha-photos dưới khóa posts/<tên tệp>
 *
 * Mặc định CHỈ XEM TRƯỚC. Thêm --apply để tải ảnh lên R2 (qua wrangler) và ghi bài vào Firestore.
 * Bài đã có trên Firestore được giữ nguyên (quản trị viên có thể đã sửa), trừ khi thêm --overwrite.
 *
 * Quyền ghi: dùng tài khoản Firebase CLI đã đăng nhập trên máy (npx firebase-tools login), là chủ project;
 * wrangler phải đăng nhập tài khoản Cloudflare có bucket giapha-photos.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PROJECT = "gen-lang-client-0885231263";
const DATABASE = "ai-studio-5efe7ae5-0c26-4948-aa25-806eda41487f";
const BUCKET = "giapha-photos";
const SUPER_ADMIN_EMAIL = "hanhtoami@gmail.com";
// OAuth client công khai của Firebase CLI (có trong mã nguồn mở firebase-tools)
const CLI_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
const overwrite = args.includes("--overwrite");
if (!dir || !fs.existsSync(path.join(dir, "posts.json"))) {
  console.error("Cách dùng: node scripts/import-posts.mjs content/posts/<đợt> [--apply] [--overwrite]");
  process.exit(1);
}
const posts = JSON.parse(fs.readFileSync(path.join(dir, "posts.json"), "utf8"));
const imgDir = path.join(dir, "images");
const images = fs.existsSync(imgDir) ? fs.readdirSync(imgDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)) : [];

// Mọi ảnh /api/photos/posts/<tệp> mà bài dùng phải có trong images/ hoặc đã có sẵn trên R2 (đợt trước)
const used = new Set(
  posts.flatMap(({ data }) => [data.coverUrl, ...(data.content || "").matchAll(/\]\((\/api\/photos\/posts\/[^)\s]+)\)/g)].map((m) => (Array.isArray(m) ? m[1] : m)))
    .filter((u) => u && u.startsWith("/api/photos/posts/"))
    .map((u) => u.slice("/api/photos/posts/".length))
);
const missing = [...used].filter((f) => !images.includes(f));

// ---- Lấy access token từ Firebase CLI ----
const cfgPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
if (!fs.existsSync(cfgPath)) throw new Error("Chưa đăng nhập Firebase CLI. Chạy: npx firebase-tools login");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const accounts = [cfg, ...(cfg.additionalAccounts || [])].filter((a) => a.tokens?.refresh_token);
const acct = accounts.find((a) => a.user?.email === SUPER_ADMIN_EMAIL) || accounts[0];
if (!acct) throw new Error("Không tìm thấy tài khoản Firebase CLI. Chạy: npx firebase-tools login");
const tok = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: acct.tokens.refresh_token, client_id: CLI_CLIENT_ID, client_secret: CLI_CLIENT_SECRET }),
});
if (!tok.ok) throw new Error("Không lấy được token: " + (await tok.text()));
const H = { Authorization: `Bearer ${(await tok.json()).access_token}`, "Content-Type": "application/json" };
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;

function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
}

console.log(`${posts.length} bài, ${images.length} ảnh trong ${dir}`);
if (missing.length) console.log(`Ảnh không có trong images/ (phải có sẵn trên R2 từ đợt trước): ${missing.join(", ")}`);

// ---- Ảnh lên R2 ----
for (const f of images) {
  if (!apply) {
    console.log(`[xem trước] ảnh  posts/${f}`);
    continue;
  }
  execFileSync("npx", ["wrangler", "r2", "object", "put", `${BUCKET}/posts/${f}`, "--remote", "--file", path.join(imgDir, f), "--content-type", "image/jpeg"], {
    stdio: ["ignore", "ignore", "inherit"],
    shell: process.platform === "win32",
  });
  console.log(`đã tải ảnh posts/${f}`);
}

// ---- Bài vào Firestore ----
const now = new Date().toISOString();
for (const { id, data } of posts) {
  const url = `${BASE}/posts/${encodeURIComponent(id)}`;
  const exists = (await fetch(url, { headers: H })).ok;
  if (exists && !overwrite) {
    console.log(`bỏ qua (đã có): ${id}`);
    continue;
  }
  if (!apply) {
    console.log(`[xem trước] ${exists ? "ghi đè" : "tạo mới"}: ${id}`);
    continue;
  }
  const doc = { ...data, createdAt: now, updatedAt: now };
  const w = await fetch(url, { method: "PATCH", headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, encode(v)])) }) });
  if (!w.ok) throw new Error(`Ghi ${id} thất bại: ${await w.text()}`);
  console.log(`${exists ? "đã ghi đè" : "đã tạo"}: ${id}`);
}
if (!apply) console.log("\nChưa ghi gì. Thêm --apply để tải ảnh và ghi bài.");
