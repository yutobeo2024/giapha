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

type FirestoreDoc = { name: string; fields?: Record<string, FirestoreValue> };
type Member = { id: string | undefined } & Record<string, unknown>;
type Snapshot = { builtAt: string; members: Member[] };

const decodeDoc = (d: FirestoreDoc): Member => ({
  id: d.name.split("/").pop(),
  ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])),
});

const documentsUrl = (env: Env) =>
  `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/${env.FIRESTORE_DATABASE_ID}/documents`;

async function putSnapshot(env: Env, snap: Snapshot): Promise<string> {
  const body = JSON.stringify(snap);
  await env.PHOTOS.put(SNAPSHOT_KEY, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { builtAt: snap.builtAt, count: String(snap.members.length) },
  });
  return body;
}

/** Đọc toàn bộ members qua REST runQuery (rules cho đọc công khai) rồi ghi bản chụp vào R2 */
export async function buildSnapshot(env: Env): Promise<{ body: string; count: number; builtAt: string }> {
  const res = await fetch(`${documentsUrl(env)}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "members" }] } }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as { document?: FirestoreDoc }[];
  const members = rows.filter((r) => r.document).map((r) => decodeDoc(r.document!));
  // Không thay bản tốt bằng bản rỗng nếu Firestore trả về trống bất thường
  if (members.length === 0) throw new Error("Firestore trả về 0 thành viên.");
  const builtAt = new Date().toISOString();
  const body = await putSnapshot(env, { builtAt, members });
  return { body, count: members.length, builtAt };
}

/**
 * Biên tập viên vừa thêm/sửa/xóa một thành viên: đọc đúng document đó từ Firestore (1 lượt đọc)
 * và thay vào bản chụp, thay vì dựng lại cả danh sách (~1.600 lượt đọc mỗi lần sửa).
 * Document không còn (đã xóa) thì bỏ khỏi bản chụp. Chưa có bản chụp thì dựng mới.
 * builtAt giữ nguyên để bản chụp vẫn được dựng lại đầy đủ sau SNAPSHOT_MAX_AGE_MS.
 */
export async function patchSnapshot(env: Env, id: string): Promise<{ count: number; builtAt: string }> {
  const obj = await env.PHOTOS.get(SNAPSHOT_KEY);
  if (!obj) {
    const { count, builtAt } = await buildSnapshot(env);
    return { count, builtAt };
  }
  const snap = (await obj.json()) as Snapshot;
  const res = await fetch(`${documentsUrl(env)}/members/${encodeURIComponent(id)}`);
  const members = snap.members.filter((m) => m.id !== id);
  if (res.ok) members.push(decodeDoc((await res.json()) as FirestoreDoc));
  else if (res.status !== 404) throw new Error(`Firestore get ${res.status}: ${await res.text()}`);
  await putSnapshot(env, { builtAt: snap.builtAt, members });
  return { count: members.length, builtAt: snap.builtAt };
}
