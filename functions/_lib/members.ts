import type { Env } from "./env";

/**
 * Bản chụp danh sách thành viên lưu trong R2, để các trang công khai không phải đọc cả collection
 * `members` từ Firestore mỗi lần mở (gói Spark chỉ có 50.000 lượt đọc mỗi ngày).
 */
export const SNAPSHOT_KEY = "snapshots/members.json";
/** Bản chụp cũ hơn mức này thì dựng lại từ Firestore ở lần xem kế tiếp */
export const SNAPSHOT_MAX_AGE_MS = 6 * 3600_000;

type FirestoreValue = Record<string, unknown>;

function decode(v: FirestoreValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) {
    const f = (v.mapValue as { fields?: Record<string, FirestoreValue> }).fields || {};
    return Object.fromEntries(Object.entries(f).map(([k, x]) => [k, decode(x)]));
  }
  if ("arrayValue" in v) return ((v.arrayValue as { values?: FirestoreValue[] }).values || []).map(decode);
  return null;
}

/** Đọc toàn bộ members qua REST runQuery (rules cho đọc công khai) rồi ghi bản chụp vào R2 */
export async function buildSnapshot(env: Env): Promise<{ body: string; count: number; builtAt: string }> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/${env.FIRESTORE_DATABASE_ID}/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "members" }] } }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FirestoreValue> } }[];
  const members = rows
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document!.name.split("/").pop(),
      ...Object.fromEntries(Object.entries(r.document!.fields || {}).map(([k, v]) => [k, decode(v)])),
    }));
  // Không thay bản tốt bằng bản rỗng nếu Firestore trả về trống bất thường
  if (members.length === 0) throw new Error("Firestore trả về 0 thành viên.");
  const builtAt = new Date().toISOString();
  const body = JSON.stringify({ builtAt, members });
  await env.PHOTOS.put(SNAPSHOT_KEY, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { builtAt, count: String(members.length) },
  });
  return { body, count: members.length, builtAt };
}
