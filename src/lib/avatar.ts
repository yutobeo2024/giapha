import type { Gender } from "../types";

/** URL ảnh đại diện mặc định (chữ cái tên) khi thành viên/người dùng chưa có ảnh. */
export function avatarUrl(name: string, options: { gender?: Gender; size?: number } = {}): string {
  const params = new URLSearchParams({ name, size: String(options.size ?? 128) });
  if (options.gender === "Nam") {
    params.set("background", "EBF5FF");
    params.set("color", "2563EB");
  } else if (options.gender === "Nữ") {
    params.set("background", "FFF5F7");
    params.set("color", "DB2777");
  } else {
    params.set("background", "FDFCF9");
    params.set("color", "8B2323");
  }
  return `https://ui-avatars.com/api/?${params.toString()}`;
}
