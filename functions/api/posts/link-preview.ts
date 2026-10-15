import { authenticate, requireAdmin, AuthError } from "../../_lib/auth";
import { json, error, type Env } from "../../_lib/env";
import { checkExternalUrl, fetchExternal, readLimited } from "../../_lib/external";

/** Giải mã các thực thể HTML hay gặp trong thẻ meta */
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function meta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const a = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${esc}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${esc}["']`, "i").exec(html);
    const v = (a || b)?.[1];
    if (v && v.trim()) return decode(v);
  }
  return undefined;
}

/**
 * POST /api/posts/link-preview  { url }  → { url, title, description, image, siteName, publishedTime }
 * Chỉ quản trị viên: dùng khi thêm bài dạng "Liên kết" để tự điền tiêu đề, tóm tắt, ảnh.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    requireAdmin(await authenticate(request, env));
    const body = (await request.json().catch(() => ({}))) as { url?: unknown };
    let target: URL;
    try {
      target = checkExternalUrl(body.url);
    } catch (e) {
      return error((e as Error).message, 400);
    }

    const res = await fetchExternal(target, "text/html,application/xhtml+xml");
    if (!res.ok) return error(`Trang nguồn trả lỗi ${res.status}.`, 502);
    if (!(res.headers.get("Content-Type") || "").includes("html")) return error("Đường dẫn không phải trang web.", 415);
    const html = new TextDecoder("utf-8").decode(await readLimited(res, 1_500_000));
    const head = html.slice(0, 300_000);

    const title = meta(head, ["og:title", "twitter:title"]) || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] || "");
    const imageRaw = meta(head, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
    let image: string | undefined;
    if (imageRaw) {
      try {
        image = new URL(imageRaw, res.url || target).toString();
      } catch {
        image = undefined;
      }
    }

    return json({
      url: res.url || target.toString(),
      title: title || undefined,
      description: meta(head, ["og:description", "description", "twitter:description"]),
      image,
      siteName: meta(head, ["og:site_name", "application-name"]) || target.hostname.replace(/^www\./, ""),
      publishedTime: meta(head, ["article:published_time", "og:published_time", "datePublished", "pubdate", "date"]),
    });
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    console.error("link-preview failed:", e);
    return error("Không đọc được trang nguồn.", 502);
  }
};
