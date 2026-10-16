import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Calendar, ChevronLeft, ChevronRight, ExternalLink, PenSquare, X, BookOpen } from "lucide-react";
import { db } from "../firebase";
import { useAuthContext } from "../hooks/AuthContext";
import { Markdown, collectImages, safeUrl } from "../lib/markdown";
import { formatPostDate, hostOf } from "../lib/posts";
import type { Post } from "../types";

const NewsDetail: React.FC = () => {
  const { id = "" } = useParams();
  const { isAdmin } = useAuthContext();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    setState("loading");
    return onSnapshot(
      doc(db, "posts", id),
      (snap) => {
        if (!snap.exists()) {
          setState("missing");
          return;
        }
        setPost({ ...snap.data(), id: snap.id } as Post);
        setState("ok");
      },
      // Bản nháp với khách: rules từ chối, coi như không có bài
      () => setState("missing")
    );
  }, [id]);

  useEffect(() => {
    if (post) document.title = `${post.title} · Gia phả họ Nguyễn Nhuận`;
    return () => {
      document.title = "Gia Phả Họ Nguyễn Nhuận";
    };
  }, [post]);

  // Ảnh bìa + ảnh trong bài, xem lớn lần lượt
  const images = useMemo(() => {
    if (!post) return [];
    const list = collectImages(post.content || "");
    if (post.coverUrl && !list.some((i) => i.src === post.coverUrl)) list.unshift({ src: post.coverUrl, caption: post.coverCaption || "" });
    return list;
  }, [post]);
  const openImage = useCallback((src: string) => setViewer(Math.max(0, images.findIndex((i) => i.src === src))), [images]);

  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(null);
      if (e.key === "ArrowRight") setViewer((v) => (v === null ? v : (v + 1) % images.length));
      if (e.key === "ArrowLeft") setViewer((v) => (v === null ? v : (v - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, images.length]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-12 h-12 border-4 border-[#8B2323] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (state === "missing" || !post) {
    return (
      <div className="text-center py-24">
        <h1 className="font-serif text-3xl font-bold mb-4">Không tìm thấy bài viết</h1>
        <Link to="/thong-tin" className="text-[#8B2323] font-bold">
          ← Về trang Thông tin
        </Link>
      </div>
    );
  }

  const main = post.sources?.[0];
  const mainUrl = main ? safeUrl(main.url) : null;

  return (
    <article className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-8">
        <Link to="/thong-tin" className="inline-flex items-center gap-2 text-[#A19D96] hover:text-[#8B2323] transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold uppercase tracking-widest">Thông tin</span>
        </Link>
        {isAdmin && (
          <Link to={`/admin?tab=posts&edit=${post.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#8B2323]">
            <PenSquare className="w-4 h-4" /> Sửa bài
          </Link>
        )}
      </div>

      <header className="space-y-5 mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] ${
              post.kind === "link" ? "bg-blue-50 text-blue-700" : "bg-[#8B2323]/10 text-[#8B2323]"
            }`}
          >
            {post.kind === "link" ? "Báo chí" : "Bài viết"}
          </span>
          {!post.published && <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">Bản nháp</span>}
        </div>
        <h1 className="font-serif text-3xl md:text-5xl font-black text-[#2D2A26] leading-tight">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#A19D96]">
          {post.eventDate && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {formatPostDate(post.eventDate)}
            </span>
          )}
          {post.authorName && <span>Biên soạn: {post.authorName}</span>}
          {main && <span>Nguồn: {main.url ? hostOf(main.url) : main.name}</span>}
        </div>
      </header>

      {post.coverUrl && (
        <figure className="post-figure mb-10">
          <button type="button" onClick={() => openImage(post.coverUrl!)} className="block w-full" aria-label="Xem ảnh lớn">
            <img src={post.coverUrl} alt={post.coverCaption || ""} className="w-full max-h-[520px] object-cover" referrerPolicy="no-referrer" />
          </button>
          {post.coverCaption && <figcaption>{post.coverCaption}</figcaption>}
        </figure>
      )}

      {post.summary && <p className="text-lg md:text-xl font-serif italic leading-relaxed text-[#4A4742] mb-8">{post.summary}</p>}

      {post.content && <Markdown source={post.content} onImageClick={openImage} />}

      {post.kind === "link" && mainUrl && (
        <a
          href={mainUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 flex items-center gap-4 p-6 rounded-3xl border border-[#E5E1D8] bg-white hover:border-[#8B2323]/40 hover:shadow-lg transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#8B2323] text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-widest text-[#A19D96]">Đọc toàn văn bài gốc</div>
            <div className="font-bold text-[#2D2A26] truncate group-hover:text-[#8B2323]">{main?.name || hostOf(mainUrl)}</div>
            <div className="text-xs text-[#A19D96] truncate">{mainUrl}</div>
          </div>
          <ArrowUpRight className="w-6 h-6 text-[#8B2323] shrink-0" />
        </a>
      )}

      {post.sources && post.sources.length > 0 && (
        <section className="mt-12 p-6 md:p-8 rounded-3xl bg-[#FDFCF9] border border-[#E5E1D8]">
          <h2 className="font-serif text-xl font-bold text-[#2D2A26] mb-4">Nguồn tham khảo</h2>
          <ol className="space-y-2 list-decimal pl-5 text-sm text-[#4A4742]">
            {post.sources.map((s, i) => {
              const href = safeUrl(s.url);
              return (
                <li key={i}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#8B2323] hover:underline break-words">
                      {s.name || hostOf(href)} <ExternalLink className="inline w-3 h-3" />
                    </a>
                  ) : (
                    s.name
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-[#A19D96] leading-relaxed">
            {post.kind === "article"
              ? "Bài viết được ban biên tập gia phả tổng hợp, tóm lược từ các nguồn trên. Hình ảnh thuộc bản quyền của nguồn gốc, được dẫn lại kèm ghi nguồn để lưu giữ tư liệu dòng họ."
              : "Nội dung trên là phần tóm tắt; bản quyền bài viết và hình ảnh thuộc về trang nguồn."}
          </p>
        </section>
      )}

      <AnimatePresence>
        {viewer !== null && images[viewer] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4"
            onClick={() => setViewer(null)}
          >
            <button className="absolute top-4 right-4 p-2 text-white/80 hover:text-white" aria-label="Đóng" onClick={() => setViewer(null)}>
              <X className="w-7 h-7" />
            </button>
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Ảnh trước"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewer((viewer - 1 + images.length) % images.length);
                  }}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Ảnh sau"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewer((viewer + 1) % images.length);
                  }}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
            <img src={images[viewer].src} alt={images[viewer].caption} className="max-w-full max-h-[80vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
            <div className="mt-4 text-center text-white/85 text-sm max-w-2xl">
              {images[viewer].caption}
              {images.length > 1 && <span className="ml-2 text-white/50">({viewer + 1}/{images.length})</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
};

export default NewsDetail;
