#!/usr/bin/env node
/**
 * Khôi phục dữ liệu Firestore từ file sao lưu do backup-worker tạo ra.
 *
 *   node scripts/restore-backup.mjs <file.json> [--collections members,events] [--only id1,id2] [--apply]
 *
 * Mặc định CHỈ XEM TRƯỚC: in ra bản ghi nào sẽ được tạo lại / ghi đè, không ghi gì.
 * Thêm --apply để ghi thật. Không bao giờ xóa bản ghi đang có trên Firestore.
 *
 * Quyền ghi: dùng tài khoản Firebase CLI đã đăng nhập trên máy (npx firebase-tools login),
 * tài khoản đó phải là chủ project. Script tự chọn tài khoản SUPER_ADMIN_EMAIL nếu có nhiều tài khoản.
 *
 * Tải file sao lưu: Cloudflare dashboard → R2 → giapha-backups → daily/ hoặc monthly/ → Download,
 * hoặc: npx wrangler r2 object get giapha-backups/daily/2026-10-14.json --remote --file backup.json
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SUPER_ADMIN_EMAIL = "hanhtoami@gmail.com";
// OAuth client công khai của Firebase CLI (có trong mã nguồn mở firebase-tools)
const CLI_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.match(/^--(collections|only)$/));
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const apply = args.includes("--apply");
if (!file) {
  console.error("Cách dùng: node scripts/restore-backup.mjs <file.json> [--collections members,events] [--only id1,id2] [--apply]");
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(file, "utf8"));
if (!backup.data || !backup.project || !backup.database) throw new Error("File không đúng định dạng sao lưu của backup-worker.");
const collections = (opt("collections") || "members,events").split(",").map((s) => s.trim());
const onlyIds = opt("only") ? new Set(opt("only").split(",").map((s) => s.trim())) : null;
const BASE = `https://firestore.googleapis.com/v1/projects/${backup.project}/databases/${backup.database}/documents`;

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

// ---- Mã hóa JSON thường về định dạng Firestore ----
function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === "object" && "__timestamp" in v) return { timestampValue: v.__timestamp };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
  throw new Error("Kiểu dữ liệu không hỗ trợ: " + typeof v);
}

async function currentIds(collectionId) {
  const r = await fetch(`${BASE}:runQuery`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], select: { fields: [{ fieldPath: "__name__" }] } } }),
  });
  if (!r.ok) throw new Error(await r.text());
  return new Set((await r.json()).filter((x) => x.document).map((x) => x.document.name.split("/").pop()));
}

console.log(`Sao lưu lúc ${backup.exportedAt} · ${JSON.stringify(backup.counts)}`);
console.log(apply ? "CHẾ ĐỘ GHI THẬT" : "Chế độ xem trước (thêm --apply để ghi)");

const writes = [];
for (const c of collections) {
  const docs = (backup.data[c] || []).filter((d) => !onlyIds || onlyIds.has(d.id));
  const existing = await currentIds(c);
  const missing = docs.filter((d) => !existing.has(d.id));
  console.log(`\n[${c}] trong file: ${docs.length} · đang có trên Firestore: ${existing.size} · sẽ tạo lại: ${missing.length} · sẽ ghi đè: ${docs.length - missing.length}`);
  for (const d of missing.slice(0, 30)) console.log(`  + ${d.id}${d.name ? "  " + d.name : d.title ? "  " + d.title : ""}`);
  if (missing.length > 30) console.log(`  ... và ${missing.length - 30} bản ghi nữa`);
  for (const d of docs) {
    const { id, __createTime, __updateTime, ...fields } = d;
    writes.push({ update: { name: `${BASE.replace("https://firestore.googleapis.com/v1/", "")}/${c}/${id}`, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) } });
  }
}

if (!apply) process.exit(0);

for (let i = 0; i < writes.length; i += 400) {
  const r = await fetch(`${BASE}:commit`, { method: "POST", headers: H, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
  if (!r.ok) throw new Error("Ghi thất bại: " + (await r.text()));
  console.log(`Đã ghi ${Math.min(i + 400, writes.length)}/${writes.length}`);
}
console.log("Khôi phục xong.");
