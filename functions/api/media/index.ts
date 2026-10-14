import { authenticate, requireAdmin, AuthError } from "../../_lib/auth";
import { json, error, type Env } from "../../_lib/env";

const MAX_BYTES = 15 * 1024 * 1024;
const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
};

/**
 * POST /api/media (multipart, field "file"): chỉ admin. Tải nhạc nền cho trang Giới thiệu.
 * Trả về { url: "/api/photos/audio/<key>" }. URL được lưu vào Firestore settings/site.introMusicUrl ở phía client.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const caller = await authenticate(request, env);
    requireAdmin(caller);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return error("Thiếu tệp (field 'file').", 400);
    const ext = EXT[file.type];
    if (!ext) return error("Chỉ nhận nhạc MP3, M4A, AAC hoặc OGG.", 415);
    if (file.size > MAX_BYTES) return error("Tệp nhạc quá lớn (tối đa 15MB).", 413);

    const key = `audio/${Date.now().toString(36)}-${crypto.randomUUID()}.${ext}`;
    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type === "audio/mp3" ? "audio/mpeg" : file.type },
      customMetadata: { uploadedBy: caller.uid, uploadedAt: new Date().toISOString(), originalName: file.name.slice(0, 200) },
    });

    return json({ url: `/api/photos/${key}`, key, name: file.name, size: file.size }, 201);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    console.error("media upload failed:", e);
    return error("Tải tệp thất bại.", 500);
  }
};
