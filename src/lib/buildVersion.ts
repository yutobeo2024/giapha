/**
 * Bản build đang chạy và cách quyết định có tải lại trang khi site đã có bản mới.
 *
 * Vì sao cần: trang là ứng dụng một trang, tab mở sẵn trên điện thoại chuyển mục không tải lại file gốc,
 * nên có thể chạy mã cũ nhiều ngày sau khi đã đưa bản mới lên (đã gặp 17/10/2026: ô tìm kiếm thiếu dòng "con ông …").
 */

/** Mã bản đang chạy, ví dụ "1.1.0+a3cc60b"; khi chạy test Node hoặc dev thì "dev" */
export const BUILD_ID: string = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

/** Phần hiện cho người xem ở chân trang: "1.1.0 (a3cc60b)" */
export function displayVersion(id: string = BUILD_ID): string {
  const [version, rest] = id.split("+");
  return rest ? `${version} (${rest})` : version;
}

/** Nội dung version.json lấy từ server có phải bản khác bản đang chạy không; dữ liệu lạ/rỗng thì coi như không */
export function isNewBuild(current: string, remote: unknown): boolean {
  if (!remote || typeof remote !== "object") return false;
  const build = (remote as { build?: unknown }).build;
  return typeof build === "string" && build.length > 0 && build !== current;
}

/** Đường dẫn có thể tải lại ngay khi tab vừa hiện lại; trang quản trị có thể đang nhập dở nên chờ tới lúc chuyển mục */
export function canReloadNow(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}
