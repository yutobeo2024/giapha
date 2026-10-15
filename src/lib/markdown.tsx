import React from "react";

/**
 * Markdown rút gọn cho bài viết trang Thông tin. Dựng thẳng thành phần tử React (không dùng
 * innerHTML) nên nội dung không chèn được mã. Hỗ trợ:
 *   ## Tiêu đề, ### Tiêu đề nhỏ, > trích dẫn, - danh sách, đoạn văn (xuống dòng = <br>)
 *   ![chú thích](url)         ảnh; nhiều dòng ảnh liền nhau thành bộ ảnh
 *   https://youtu.be/...       dòng chỉ có link YouTube thành video nhúng
 *   **đậm**, *nghiêng*, [chữ](url)
 */

export interface MdImage {
  src: string;
  caption: string;
}

const IMG_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const YT_LINE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})\S*$/;

/** Chỉ nhận http(s) và đường dẫn nội bộ bắt đầu bằng "/" */
export function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return null;
}

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{m[2]}</em>);
    else {
      const href = safeUrl(m[4]);
      if (!href) out.push(m[3]);
      else {
        const external = /^https?:/i.test(href);
        out.push(
          <a key={k} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {m[3]}
          </a>
        );
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withBreaks(text: string, keyBase: string): React.ReactNode[] {
  return text.split("\n").flatMap((line, i) => (i === 0 ? inline(line, `${keyBase}-${i}`) : [<br key={`${keyBase}-br${i}`} />, ...inline(line, `${keyBase}-${i}`)]));
}

/** Lấy danh sách ảnh trong bài (để xem ảnh lớn theo thứ tự) */
export function collectImages(md: string): MdImage[] {
  return md
    .split("\n")
    .map((l) => IMG_LINE.exec(l.trim()))
    .filter((m): m is RegExpExecArray => !!m && !!safeUrl(m[2]))
    .map((m) => ({ src: safeUrl(m[2])!, caption: m[1] }));
}

export function Markdown({ source, onImageClick }: { source: string; onImageClick?: (src: string) => void }) {
  const blocks: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let k = 0;

  const figure = (img: MdImage, key: string) => (
    <figure key={key} className="post-figure">
      <button type="button" onClick={() => onImageClick?.(img.src)} className="block w-full" aria-label={img.caption || "Xem ảnh lớn"}>
        <img src={img.src} alt={img.caption} loading="lazy" />
      </button>
      {img.caption && <figcaption>{inline(img.caption, key + "c")}</figcaption>}
    </figure>
  );

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    const key = `b${k++}`;

    // Ảnh: gom các dòng ảnh liền nhau
    if (IMG_LINE.test(line)) {
      const imgs: MdImage[] = [];
      while (i < lines.length && IMG_LINE.test(lines[i].trim())) {
        const m = IMG_LINE.exec(lines[i].trim())!;
        const src = safeUrl(m[2]);
        if (src) imgs.push({ src, caption: m[1] });
        i++;
      }
      if (imgs.length === 1) blocks.push(figure(imgs[0], key));
      else if (imgs.length > 1)
        blocks.push(
          <div key={key} className={`post-gallery ${imgs.length === 2 || imgs.length === 4 ? "post-gallery-2" : ""}`}>
            {imgs.map((img, j) => figure(img, `${key}-${j}`))}
          </div>
        );
      continue;
    }

    const yt = YT_LINE.exec(line);
    if (yt) {
      blocks.push(
        <div key={key} className="post-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt[1]}`}
            title="Video"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={key}>{inline(line.slice(4), key)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={key}>{inline(line.slice(3), key)}</h2>);
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(<blockquote key={key}>{withBreaks(buf.join("\n"), key)}</blockquote>);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}-${j}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Đoạn văn: các dòng liền nhau đến dòng trống hoặc khối đặc biệt
    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || IMG_LINE.test(l) || YT_LINE.test(l) || l.startsWith("## ") || l.startsWith("### ") || l.startsWith(">") || /^[-*]\s+/.test(l)) break;
      buf.push(l);
      i++;
    }
    blocks.push(<p key={key}>{withBreaks(buf.join("\n"), key)}</p>);
  }

  return <div className="post-body">{blocks}</div>;
}
