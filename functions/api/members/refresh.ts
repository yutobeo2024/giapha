import { authenticate, requireEditor, AuthError } from "../../_lib/auth";
import { buildSnapshot, patchSnapshot } from "../../_lib/members";
import { json, error, type Env } from "../../_lib/env";

/** Document id của Firestore (tự sinh 20 ký tự) hoặc id dạng slug do script nhập đặt */
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * POST /api/members/refresh → { count, builtAt, patched? }. Biên tập viên gọi sau khi thêm/sửa/xóa thành viên.
 * Body JSON { id } (tùy chọn): chỉ cập nhật thành viên đó trong bản chụp (1 lượt đọc Firestore);
 * không có body thì dựng lại toàn bộ bản chụp.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    requireEditor(await authenticate(request, env));
    let id: string | null = null;
    if ((request.headers.get("Content-Type") || "").includes("json")) {
      const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
      if (body?.id !== undefined) {
        if (typeof body.id !== "string" || !ID_RE.test(body.id)) return error("id thành viên không hợp lệ.", 400);
        id = body.id;
      }
    }
    const { count, builtAt } = id ? await patchSnapshot(env, id) : await buildSnapshot(env);
    return json({ count, builtAt, patched: id ?? undefined });
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    console.error("members snapshot refresh failed:", e);
    return error("Không làm mới được danh sách thành viên.", 502);
  }
};
