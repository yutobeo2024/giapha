/**
 * Tải nội dung từ trang ngoài cho tính năng nhúng bài báo (chỉ quản trị viên gọi).
 * Chặn địa chỉ không phải http(s), tên máy nội bộ và IP riêng; giới hạn thời gian và dung lượng.
 */
const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[.*\])$/i;

export function checkExternalUrl(raw: unknown): URL {
  if (typeof raw !== "string" || raw.length > 2000) throw new Error("Đường dẫn không hợp lệ.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Đường dẫn không hợp lệ.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Chỉ nhận đường dẫn http hoặc https.");
  if (PRIVATE_HOST.test(url.hostname)) throw new Error("Không được truy cập địa chỉ nội bộ.");
  return url;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 giaphanguyennhuan.com";

export async function fetchExternal(url: URL, accept: string, referer?: string): Promise<Response> {
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "vi,en;q=0.8", ...(referer ? { Referer: referer } : {}) },
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  // Trang đích sau chuyển hướng cũng phải là địa chỉ công khai
  checkExternalUrl(res.url || url.toString());
  return res;
}

/** Đọc tối đa maxBytes byte của body, vượt quá thì báo lỗi */
export async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Tệp quá lớn.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
