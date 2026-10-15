import { authenticate, requireEditor, AuthError } from "../../_lib/auth";
import { buildSnapshot } from "../../_lib/members";
import { json, error, type Env } from "../../_lib/env";

/** POST /api/members/refresh → { count, builtAt }. Biên tập viên gọi sau khi thêm/sửa/xóa thành viên. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    requireEditor(await authenticate(request, env));
    const { count, builtAt } = await buildSnapshot(env);
    return json({ count, builtAt });
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    console.error("members snapshot refresh failed:", e);
    return error("Không làm mới được danh sách thành viên.", 502);
  }
};
