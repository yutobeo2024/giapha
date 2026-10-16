#!/usr/bin/env node
/**
 * Chuyển chi tộc từ câu "Chi ông X - ..." trong tiểu sử sang ô Chi tộc (branch) cho toàn bộ thành viên.
 *
 *   node scripts/fill-branch.mjs [--apply] [--keep-sentence]
 *
 * Mặc định CHỈ XEM TRƯỚC. Thêm --apply để ghi thật (chỉ sửa hai trường branch và biography, các trường khác giữ nguyên).
 * --keep-sentence: giữ nguyên câu chi trong tiểu sử (mặc định bỏ câu đó vì đã có ô Chi tộc).
 * Luôn sao lưu toàn bộ members ra D:\GIA PHẢ\backup-members-truoc-dien-chi-<giờ>.json trước
 * (định dạng backup-worker, khôi phục bằng scripts/restore-backup.mjs).
 *
 * Quyền ghi: tài khoản Firebase CLI đã đăng nhập (SUPER_ADMIN_EMAIL), như scripts/restore-backup.mjs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SUPER_ADMIN_EMAIL = "hanhtoami@gmail.com";
const CLI_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";
const PROJECT = "gen-lang-client-0885231263";
const DATABASE = "ai-studio-5efe7ae5-0c26-4948-aa25-806eda41487f";
const BACKUP_DIR = "D:\\GIA PHẢ";

const apply = process.argv.includes("--apply");
const keepSentence = process.argv.includes("--keep-sentence");

/** Câu ghi chi trong tiểu sử (do script nhập kỷ yếu 2023 thêm vào cuối) */
const CHI_RE = /(?:Chi (?:ông|bà|Quỳnh)|Nhánh)[^.]*/;
/** Cách ghi lệch trong kỷ yếu → tên thống nhất (theo Bảng chi trưởng các địa phương) */
const NORMALIZE = {
  "Chi ông Hưng (Phổ) Văn Thành": "Chi ông Hưng (Phổ) - Văn Thành",
  "Chi ông Hưng ( Phổ) - Văn Thành": "Chi ông Hưng (Phổ) - Văn Thành",
  "Chi ông Long (Trọng) Phúc Thành": "Chi ông Long (Trọng) - Phúc Thành",
  "Chi ông Trọng - Phúc Thành": "Chi ông Long (Trọng) - Phúc Thành",
  "Chi ông Thông": "Chi ông Thông - Yên Thịnh - Phúc Thành",
  "Chi ông Nguyễn Đình Hoàng - Đức Thành": "Chi ông Hoàng - Đức Thành",
  "Chi ông Niêm - Phúc Thành": "Chi ông Niệm - Phúc Thành",
};

/** Tách chi khỏi tiểu sử: trả về { branch, biography } mới; không có câu chi thì branch rỗng */
export function splitBranch(biography) {
  const bio = (biography || "").trim();
  const m = bio.match(CHI_RE);
  if (!m) return { branch: "", biography: bio };
  const raw = m[0].replace(/\s+/g, " ").trim();
  const branch = NORMALIZE[raw] || raw;
  if (keepSentence) return { branch, biography: bio };
  const sentences = bio.split(/(?<=\.)\s+/);
  const rest = sentences.filter((s) => !CHI_RE.test(s.trim()) || !/^(Chi |Nhánh)/.test(s.trim())).join(" ").trim();
  return { branch, biography: rest };
}

// ---- Token Firebase CLI ----
const cfgPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
if (!fs.existsSync(cfgPath)) throw new Error("Chưa đăng nhập Firebase CLI. Chạy: npx firebase-tools login");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const accounts = [cfg, ...(cfg.additionalAccounts || [])].filter((a) => a.tokens?.refresh_token);
const acct = accounts.find((a) => a.user?.email === SUPER_ADMIN_EMAIL) || accounts[0];
if (!acct) throw new Error("Không tìm thấy tài khoản Firebase CLI.");
const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: acct.tokens.refresh_token, client_id: CLI_CLIENT_ID, client_secret: CLI_CLIENT_SECRET }),
});
if (!tokRes.ok) throw new Error("Không lấy được token: " + (await tokRes.text()));
const accessToken = (await tokRes.json()).access_token;
const H = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;

// ---- Đọc toàn bộ members ----
function decode(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return { __timestamp: v.timestampValue };
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  throw new Error("Kiểu lạ: " + JSON.stringify(v));
}
const rows = [];
let pageToken;
do {
  const body = { structuredQuery: { from: [{ collectionId: "members" }], limit: 1000 }, ...(pageToken ? {} : {}) };
  // runQuery không phân trang bằng token: dùng orderBy __name__ + startAt để đọc tiếp
  if (rows.length) body.structuredQuery.startAt = { values: [{ referenceValue: rows[rows.length - 1].__ref }], before: false };
  body.structuredQuery.orderBy = [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }];
  const r = await fetch(`${BASE}:runQuery`, { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("Đọc Firestore lỗi: " + (await r.text()));
  const docs = (await r.json()).filter((x) => x.document);
  for (const { document } of docs) {
    rows.push({
      id: document.name.split("/").pop(),
      __ref: document.name,
      __createTime: document.createTime,
      __updateTime: document.updateTime,
      ...Object.fromEntries(Object.entries(document.fields || {}).map(([k, v]) => [k, decode(v)])),
    });
  }
  pageToken = docs.length === 1000;
} while (pageToken);
console.log(`Đọc được ${rows.length} thành viên từ Firestore.`);

// ---- Sao lưu (định dạng backup-worker) ----
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupFile = path.join(BACKUP_DIR, `backup-members-truoc-dien-chi-${stamp}.json`);
fs.writeFileSync(
  backupFile,
  JSON.stringify(
    { project: PROJECT, database: DATABASE, exportedAt: new Date().toISOString(), counts: { members: rows.length }, data: { members: rows.map(({ __ref, ...m }) => m) } },
    null,
    1
  )
);
console.log(`Đã sao lưu ${rows.length} người vào ${backupFile}`);

// ---- Lập kế hoạch ----
const plan = [];
const byBranch = new Map();
const normalized = new Map();
const noChi = [];
let unchanged = 0;
for (const m of rows) {
  const { branch, biography } = splitBranch(m.biography);
  if (!branch) {
    noChi.push(m);
    continue;
  }
  const raw = (m.biography || "").match(CHI_RE)?.[0].replace(/\s+/g, " ").trim();
  if (raw && raw !== branch) normalized.set(raw, (normalized.get(raw) || 0) + 1);
  byBranch.set(branch, (byBranch.get(branch) || 0) + 1);
  if ((m.branch || "") === branch && (m.biography || "").trim() === biography) {
    unchanged++;
    continue;
  }
  plan.push({ m, branch, biography });
}
console.log(`\nSẽ điền Chi tộc cho ${plan.length} người (${unchanged} người đã đúng, bỏ qua).`);
for (const [b, n] of [...byBranch.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${b}`);
console.log(`\nCách ghi lệch được thống nhất lại (${[...normalized.values()].reduce((a, b) => a + b, 0)} người):`);
for (const [raw, n] of normalized) console.log(`  ${n} × "${raw}" → "${NORMALIZE[raw] || raw}"`);
const gens = {};
for (const m of noChi) gens[m.generation] = (gens[m.generation] || 0) + 1;
console.log(`\nKhông có câu chi, để trống ô Chi tộc: ${noChi.length} người, theo đời: ${JSON.stringify(gens)}`);
console.log("\nVí dụ:");
for (const p of plan.slice(0, 3)) console.log(`  ${p.m.name} (đời ${p.m.generation})\n    Chi tộc: ${p.branch}\n    Tiểu sử: "${(p.m.biography || "").slice(0, 90)}" → "${p.biography.slice(0, 90)}"`);
if (plan.some((p) => p.m.branch && p.m.branch !== p.branch)) {
  console.log("\nCHÚ Ý: có người đã có ô Chi tộc khác với câu trong tiểu sử:");
  for (const p of plan.filter((p) => p.m.branch && p.m.branch !== p.branch)) console.log(`  ${p.m.name}: "${p.m.branch}" → "${p.branch}"`);
}

if (!apply) {
  console.log("\nChế độ xem trước, chưa ghi gì. Thêm --apply để ghi thật.");
  process.exit(0);
}

// ---- Ghi: chỉ hai trường branch và biography ----
const writes = plan.map((p) => ({
  update: { name: p.m.__ref, fields: { branch: { stringValue: p.branch }, biography: { stringValue: p.biography } } },
  updateMask: { fieldPaths: ["branch", "biography"] },
}));
for (let i = 0; i < writes.length; i += 400) {
  const r = await fetch(`${BASE}:commit`, { method: "POST", headers: H, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
  if (!r.ok) throw new Error("Ghi thất bại: " + (await r.text()));
  console.log(`Đã ghi ${Math.min(i + 400, writes.length)}/${writes.length}`);
}
await fetch(`${BASE}/activities`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({
    fields: {
      userName: { stringValue: "Quản trị (script)" },
      action: { stringValue: `đã điền ô Chi tộc cho ${plan.length} người theo kỷ yếu 2023` },
      timestamp: { stringValue: new Date().toISOString() },
    },
  }),
});
console.log("Ghi xong.");

// Bản chụp công khai: token Google của Firebase CLI không đổi được sang ID token Firebase (khác audience),
// nên không gọi được POST /api/members/refresh từ đây. Bản chụp tự dựng lại trong vòng 6 giờ; muốn ngay thì xóa bản cũ trong R2.
console.log(
  "Trang ngoài sẽ hiện Chi tộc khi bản chụp /api/members dựng lại (tự động trong vòng 6 giờ). Muốn ngay, chạy:" +
  "\n  npx wrangler r2 object delete giapha-photos/snapshots/members.json --remote"
);
