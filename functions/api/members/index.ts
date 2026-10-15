import { buildSnapshot, SNAPSHOT_KEY, SNAPSHOT_MAX_AGE_MS } from "../../_lib/members";
import { error, type Env } from "../../_lib/env";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60",
};

/**
 * GET /api/members → { builtAt, members: [...] }
 * Trả bản chụp trong R2; bản chụp quá cũ hoặc chưa có thì dựng lại từ Firestore.
 * Firestore lỗi thì vẫn trả bản cũ (nếu có) để trang không trắng.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const obj = await env.PHOTOS.get(SNAPSHOT_KEY);
  const builtAt = obj?.customMetadata?.builtAt;
  const fresh = !!builtAt && Date.now() - Date.parse(builtAt) < SNAPSHOT_MAX_AGE_MS;
  if (obj && fresh) return new Response(obj.body, { headers: HEADERS });

  try {
    const snap = await buildSnapshot(env);
    return new Response(snap.body, { headers: HEADERS });
  } catch (e) {
    console.error("members snapshot rebuild failed:", e);
    if (obj) return new Response(obj.body, { headers: HEADERS });
    return error("Không tải được danh sách thành viên.", 502);
  }
};
