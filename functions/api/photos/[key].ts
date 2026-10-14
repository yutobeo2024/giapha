import type { Env } from "../../_lib/env";

/** GET /api/photos/:key → nội dung ảnh từ R2, cache 1 năm (key là duy nhất, không ghi đè). */
export const onRequestGet: PagesFunction<Env> = async ({ params, env, request }) => {
  const key = String(params.key || "");
  if (!/^[A-Za-z0-9._-]+$/.test(key)) return new Response("Bad key", { status: 400 });

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const object = await env.PHOTOS.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  const response = new Response(object.body, { headers });
  await cache.put(request, response.clone());
  return response;
};
