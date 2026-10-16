/**
 * Worker sao lưu Firestore định kỳ cho Gia Phả.
 *
 * Mỗi đêm (cron trong wrangler.toml) đọc các collection công khai qua Firestore REST `runQuery`
 * (rules cho phép đọc công khai, nên không cần khóa bí mật) và ghi một file JSON vào bucket R2
 * `giapha-backups`:
 *   daily/YYYY-MM-DD.json    giữ DAILY_KEEP_DAYS ngày gần nhất
 *   monthly/YYYY-MM.json     bản đầu tiên của mỗi tháng, giữ vĩnh viễn
 *
 * Collection `users` (hồ sơ đăng nhập, vai trò) KHÔNG đọc được công khai nên không nằm trong bản sao lưu.
 * `posts` chỉ đọc công khai được bài đã xuất bản (rules bắt buộc lọc), nên bài nháp cũng không được sao lưu.
 */

export interface Env {
  BACKUPS: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  FIRESTORE_DATABASE_ID: string;
  COLLECTIONS: string; // danh sách cách nhau bởi dấu phẩy
  DAILY_KEEP_DAYS: string;
}

type FirestoreValue = Record<string, unknown>;
interface FirestoreDoc {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

/** Chuyển giá trị Firestore REST sang JSON thường để file sao lưu dễ đọc. */
function decode(v: FirestoreValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return { __timestamp: v.timestampValue };
  if ("mapValue" in v) {
    const f = (v.mapValue as { fields?: Record<string, FirestoreValue> }).fields || {};
    return Object.fromEntries(Object.entries(f).map(([k, x]) => [k, decode(x)]));
  }
  if ("arrayValue" in v) {
    const vals = (v.arrayValue as { values?: FirestoreValue[] }).values || [];
    return vals.map(decode);
  }
  return v;
}

/**
 * Điều kiện bắt buộc khi đọc công khai: rules chỉ cho khách đọc bài đã xuất bản,
 * truy vấn không lọc sẽ bị từ chối cả collection (403).
 */
const PUBLIC_FILTERS: Record<string, unknown> = {
  posts: { fieldFilter: { field: { fieldPath: "published" }, op: "EQUAL", value: { booleanValue: true } } },
};

export async function readCollection(env: Env, collectionId: string) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/${env.FIRESTORE_DATABASE_ID}/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId }], ...(PUBLIC_FILTERS[collectionId] ? { where: PUBLIC_FILTERS[collectionId] } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`${collectionId}: HTTP ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as { document?: FirestoreDoc }[];
  return rows
    .filter((r) => r.document)
    .map((r) => {
      const d = r.document!;
      return {
        id: d.name.split("/").pop(),
        ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])),
        __createTime: d.createTime,
        __updateTime: d.updateTime,
      };
    });
}

/** Ngày theo giờ Việt Nam (UTC+7) dạng YYYY-MM-DD. */
function vnDate(now: Date): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export async function runBackup(env: Env, now = new Date()) {
  const collections = env.COLLECTIONS.split(",").map((s) => s.trim()).filter(Boolean);
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const c of collections) {
    data[c] = await readCollection(env, c);
    counts[c] = data[c].length;
  }

  const day = vnDate(now);
  const body = JSON.stringify(
    {
      app: "giapha-nguyen-nhuan",
      exportedAt: now.toISOString(),
      project: env.FIREBASE_PROJECT_ID,
      database: env.FIRESTORE_DATABASE_ID,
      counts,
      data,
    },
    null,
    2
  );

  // An toàn: không ghi đè bản tốt bằng bản rỗng nếu Firestore trả về trống bất thường.
  if ((counts.members ?? 1) === 0) {
    throw new Error("Firestore trả về 0 thành viên, bỏ qua để không tạo bản sao lưu rỗng.");
  }

  const meta = { httpMetadata: { contentType: "application/json; charset=utf-8" }, customMetadata: { counts: JSON.stringify(counts) } };
  await env.BACKUPS.put(`daily/${day}.json`, body, meta);

  const monthKey = `monthly/${day.slice(0, 7)}.json`;
  if (!(await env.BACKUPS.head(monthKey))) {
    await env.BACKUPS.put(monthKey, body, meta);
  }

  // Dọn bản hằng ngày quá hạn
  const keepDays = Number(env.DAILY_KEEP_DAYS) || 60;
  const cutoff = vnDate(new Date(now.getTime() - keepDays * 86400_000));
  const listed = await env.BACKUPS.list({ prefix: "daily/" });
  const expired = listed.objects.map((o) => o.key).filter((k) => k.slice(6, 16) < cutoff);
  if (expired.length) await env.BACKUPS.delete(expired);

  return { day, counts, bytes: body.length, deleted: expired };
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runBackup(env).then(
        (r) => console.log("backup ok", JSON.stringify(r)),
        (e) => {
          console.error("backup failed", e instanceof Error ? e.message : e);
          throw e;
        }
      )
    );
  },

  // Không mở HTTP công khai: mọi request trả 404. Chạy thủ công bằng cron trigger trên dashboard.
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
