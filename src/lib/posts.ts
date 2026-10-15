import type { User } from "firebase/auth";
import type { Post } from "../types";

/** "Ngày hội gặp mặt lần III" → "ngay-hoi-gap-mat-lan-iii" (dùng làm id và đường dẫn bài) */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** "2026-03-15" → "15/03/2026" */
export function formatPostDate(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Ghim lên đầu, rồi mới nhất trước (theo ngày sự kiện, thiếu thì ngày tạo) */
export function sortPosts(posts: Post[]): Post[] {
  const key = (p: Post) => p.eventDate || p.createdAt.slice(0, 10);
  return [...posts].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || key(b).localeCompare(key(a)));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  publishedTime?: string;
}

async function call<T>(path: string, user: User, body: unknown): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error || `Lỗi máy chủ (${res.status}).`);
  return data as T;
}

/** Đọc tiêu đề, mô tả, ảnh đại diện của một bài báo (chỉ quản trị viên) */
export const fetchLinkPreview = (url: string, user: User) => call<LinkPreview>("/api/posts/link-preview", user, { url });

/** Chép ảnh từ trang khác về kho ảnh của site để không bị mất khi trang gốc đổi (chỉ quản trị viên) */
export const importImage = (url: string, user: User, referer?: string) =>
  call<{ url: string }>("/api/posts/import-image", user, { url, referer });
