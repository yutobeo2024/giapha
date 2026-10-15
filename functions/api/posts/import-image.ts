import { authenticate, requireAdmin, AuthError } from "../../_lib/auth";
import { json, error, type Env } from "../../_lib/env";
import { checkExternalUrl, fetchExternal, readLimited } from "../../_lib/external";

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/**
 * POST /api/posts/import-image  { url, referer? }  → { url: "/api/photos/posts/<key>" }
 * Chỉ quản trị viên: chép ảnh của bài báo gốc về R2 để bài trên site không mất ảnh khi trang gốc
 * đổi hoặc chặn hiển thị từ trang khác. Người dùng vẫn phải ghi nguồn ảnh trong bài.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const caller = await authenticate(request, env);
    requireAdmin(caller);
    const body = (await request.json().catch(() => ({}))) as { url?: unknown; referer?: unknown };
    let target: URL;
    try {
      target = checkExternalUrl(body.url);
    } catch (e) {
      return error((e as Error).message, 400);
    }
    const referer = typeof body.referer === "string" && /^https?:\/\//.test(body.referer) ? body.referer : target.origin + "/";

    const res = await fetchExternal(target, "image/avif,image/webp,image/*;q=0.8", referer);
    if (!res.ok) return error(`Trang nguồn trả lỗi ${res.status}.`, 502);
    const type = (res.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!EXT[type]) return error("Đường dẫn không phải ảnh JPG, PNG, WebP hoặc GIF.", 415);
    const bytes = await readLimited(res, MAX_BYTES);

    const key = `posts/${Date.now().toString(36)}-${crypto.randomUUID()}.${EXT[type]}`;
    await env.PHOTOS.put(key, bytes, {
      httpMetadata: { contentType: type },
      customMetadata: { uploadedBy: caller.uid, uploadedAt: new Date().toISOString(), sourceUrl: target.toString().slice(0, 1000) },
    });
    return json({ url: `/api/photos/${key}` }, 201);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    if (e instanceof Error && e.message === "Tệp quá lớn.") return error("Ảnh quá lớn (tối đa 8MB).", 413);
    console.error("import-image failed:", e);
    return error("Không chép được ảnh.", 502);
  }
};
