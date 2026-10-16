// Chạy: npm test. Pages Functions và Worker sao lưu, gọi mạng được giả lập (không chạm Firestore/R2 thật).
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { checkExternalUrl, fetchExternal } from "../functions/_lib/external.ts";
import { buildSnapshot } from "../functions/_lib/members.ts";
import { runBackup } from "../backup-worker/src/index.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Firestore trả về một document có trường `id` khác id thật của document */
const forgedRow = [
  {
    document: {
      name: "projects/p/databases/d/documents/members/real-id",
      fields: { id: { stringValue: "forged-id" }, name: { stringValue: "Ông A" }, generation: { integerValue: "3" } },
    },
  },
];
const env = { FIREBASE_PROJECT_ID: "p", FIRESTORE_DATABASE_ID: "d", SUPER_ADMIN_EMAIL: "owner@example.test" };

test("bản chụp members giữ id thật của document dù dữ liệu có trường id", async () => {
  globalThis.fetch = (async () => Response.json(forgedRow)) as typeof fetch;
  const snap = await buildSnapshot({ ...env, PHOTOS: { put: async () => {} } } as never);
  const m = JSON.parse(snap.body).members[0];
  assert.equal(m.id, "real-id");
  assert.equal(m.name, "Ông A");
});

test("bản sao lưu giữ id thật của document dù dữ liệu có trường id", async () => {
  globalThis.fetch = (async () => Response.json(forgedRow)) as typeof fetch;
  const writes: { key: string; body: string }[] = [];
  const bucket = {
    put: async (key: string, body: string) => void writes.push({ key, body }),
    head: async () => null,
    list: async () => ({ objects: [] }),
    delete: async () => {},
  };
  await runBackup({ ...env, COLLECTIONS: "members", DAILY_KEEP_DAYS: "60", BACKUPS: bucket } as never, new Date("2026-10-16T19:00:00Z"));
  assert.equal(JSON.parse(writes[0].body).data.members[0].id, "real-id");
});

test("địa chỉ nội bộ bị chặn, kể cả viết kèm dấu chấm cuối", () => {
  for (const url of [
    "http://localhost/",
    "http://localhost./",
    "http://LOCALHOST../x",
    "http://api.localhost/",
    "http://127.0.0.1./",
    "http://0.0.0.0/",
    "http://10.1.2.3/",
    "http://192.168.1.1/",
    "http://172.16.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://2130706433/",
    "file:///etc/passwd",
  ]) {
    assert.throws(() => checkExternalUrl(url), undefined, url);
  }
  assert.equal(checkExternalUrl("https://vnexpress.net/bai-viet").hostname, "vnexpress.net");
});

test("chuyển hướng: kiểm tra địa chỉ từng bước TRƯỚC khi gửi, không tự theo", async () => {
  const sent: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.equal(init.redirect, "manual");
    sent.push(url);
    if (url === "https://a.example/") return new Response(null, { status: 301, headers: { Location: "/b" } });
    if (url === "https://a.example/b") return new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/" } });
    return new Response("không được tới đây");
  }) as typeof fetch;
  await assert.rejects(fetchExternal(new URL("https://a.example/"), "text/html"), /nội bộ/);
  assert.deepEqual(sent, ["https://a.example/", "https://a.example/b"], "không gửi yêu cầu nào tới địa chỉ nội bộ");
});

test("chuyển hướng hợp lệ thì đi tiếp tới trang cuối; quá 5 bước thì dừng", async () => {
  globalThis.fetch = (async (url: string) =>
    url === "https://a.example/" ? new Response(null, { status: 308, headers: { Location: "https://b.example/bai" } }) : new Response("<html>ok</html>")) as typeof fetch;
  const res = await fetchExternal(new URL("https://a.example/"), "text/html");
  assert.equal(await res.text(), "<html>ok</html>");

  let n = 0;
  globalThis.fetch = (async () => new Response(null, { status: 302, headers: { Location: `https://a.example/${++n}` } })) as typeof fetch;
  await assert.rejects(fetchExternal(new URL("https://a.example/"), "text/html"), /quá nhiều/);
  assert.equal(n, 6, "lần đầu + 5 lần chuyển hướng");
});
