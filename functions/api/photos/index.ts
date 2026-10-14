import { authenticate, requireEditor, AuthError } from "../../_lib/auth";
import { json, error, type Env } from "../../_lib/env";

const MAX_BYTES = 2 * 1024 * 1024; // client đã nén về ~800px JPEG; chặn phòng hờ 2MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** POST /api/photos  (multipart/form-data, field "file") → { url: "/api/photos/<key>" } */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const caller = await authenticate(request, env);
    requireEditor(caller);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return error("Thiếu tệp ảnh (field 'file').", 400);
    if (!ALLOWED.has(file.type)) return error("Chỉ nhận JPG, PNG hoặc WebP.", 415);
    if (file.size > MAX_BYTES) return error("Ảnh quá lớn (tối đa 2MB sau khi nén).", 413);

    const key = `${Date.now().toString(36)}-${crypto.randomUUID()}.${EXT[file.type]}`;
    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: caller.uid, uploadedAt: new Date().toISOString() },
    });

    return json({ url: `/api/photos/${key}`, key }, 201);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    console.error("photo upload failed:", e);
    return error("Tải ảnh thất bại.", 500);
  }
};
