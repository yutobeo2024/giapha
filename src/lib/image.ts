import type { User } from "firebase/auth";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // 10MB file gốc
const MAX_EDGE = 800; // px
const JPEG_QUALITY = 0.85;

/**
 * Thu nhỏ ảnh ở trình duyệt về tối đa 800px cạnh dài, xuất JPEG.
 * Ảnh thành viên gia phả không cần độ phân giải cao; ~40-80KB mỗi ảnh.
 */
export async function resizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Tệp không phải hình ảnh.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Ảnh quá lớn (tối đa 10MB).");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

/**
 * Upload ảnh lên Cloudflare R2 qua Pages Function /api/photos.
 * Trả về đường dẫn tương đối "/api/photos/<key>" để lưu vào photoUrl.
 */
export async function uploadPhoto(file: File, user: User): Promise<string> {
  const blob = await resizeImage(file);
  const token = await user.getIdToken();

  const form = new FormData();
  form.append("file", blob, "photo.jpg");

  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.");
    if (res.status === 403) throw new Error("Bạn chưa được cấp quyền tải ảnh.");
    throw new Error(text || `Tải ảnh thất bại (${res.status}).`);
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
