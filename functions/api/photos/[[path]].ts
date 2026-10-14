import type { Env } from "../../_lib/env";

/**
 * GET /api/photos/<key>        ảnh thành viên
 * GET /api/photos/audio/<key>  nhạc nền trang Giới thiệu
 *
 * Key là duy nhất, không ghi đè nên cache 1 năm. Hỗ trợ header Range (trả 206)
 * để trình duyệt phát, tua và lặp nhạc chuẩn, nhất là Safari trên iPhone/iPad.
 */
export const onRequestGet: PagesFunction<Env> = async ({ params, env, request }) => {
  const parts = Array.isArray(params.path) ? params.path : [String(params.path || "")];
  const key = parts.join("/");
  if (!/^(audio\/)?[A-Za-z0-9._-]+$/.test(key)) return new Response("Bad key", { status: 400 });

  const rangeHeader = request.headers.get("Range");

  // Chỉ dùng cache cho request không có Range
  const cache = caches.default;
  if (!rangeHeader) {
    const cached = await cache.match(request);
    if (cached) return cached;
  }

  const head = await env.PHOTOS.head(key);
  if (!head) return new Response("Not found", { status: 404 });
  const size = head.size;

  const headers = new Headers();
  head.writeHttpMetadata(headers);
  headers.set("ETag", head.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Accept-Ranges", "bytes");

  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new Response("Invalid range", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    let start: number;
    let end: number;
    if (m[1] === "") {
      // bytes=-N : N byte cuối
      const suffix = Number(m[2]);
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) {
      return new Response("Range not satisfiable", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const obj = await env.PHOTOS.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return new Response("Not found", { status: 404 });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(obj.body, { status: 206, headers });
  }

  const object = await env.PHOTOS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  headers.set("Content-Length", String(size));
  const response = new Response(object.body, { headers });
  await cache.put(request, response.clone());
  return response;
};
