import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { motion } from "framer-motion";
import { ArrowUpRight, Newspaper, PenSquare, Pin, Calendar, FileText } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuthContext } from "../hooks/AuthContext";
import { formatPostDate, hostOf, sortPosts } from "../lib/posts";
import type { Post } from "../types";

function KindBadge({ post }: { post: Post }) {
  return post.kind === "link" ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
      <Newspaper className="w-3 h-3" /> Báo chí
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#8B2323]/10 text-[#8B2323] text-[10px] font-bold uppercase tracking-wider">
      <FileText className="w-3 h-3" /> Bài viết
    </span>
  );
}

function Meta({ post }: { post: Post }) {
  const src = post.sources?.[0];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A19D96]">
      {post.eventDate && (
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {formatPostDate(post.eventDate)}
        </span>
      )}
      {src && <span>Nguồn: {src.url ? hostOf(src.url) : src.name}</span>}
    </div>
  );
}

function Cover({ post, className }: { post: Post; className: string }) {
  return post.coverUrl ? (
    <img src={post.coverUrl} alt="" loading="lazy" className={`${className} object-cover`} referrerPolicy="no-referrer" />
  ) : (
    <div className={`${className} bg-gradient-to-br from-[#8B2323] to-[#5a1616] flex items-center justify-center`}>
      <span className="font-serif text-5xl text-white/80">阮</span>
    </div>
  );
}

const News: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuthContext();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    // Khách chỉ được đọc bài đã xuất bản (rules bắt buộc lọc); quản trị viên thấy cả bản nháp
    const q = isAdmin ? collection(db, "posts") : query(collection(db, "posts"), where("published", "==", true));
    return onSnapshot(
      q,
      (snap) => {
        setPosts(sortPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post)));
        setLoading(false);
      },
      (err) => {
        setError(handleFirestoreError(err, OperationType.LIST, "posts"));
        setLoading(false);
      }
    );
  }, [isAdmin, authLoading]);

  const [featured, ...rest] = posts;

  return (
    <div className="space-y-10 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">Thông Tin Dòng Họ</h1>
          <p className="text-[#6B665F]">Tin tức, bài viết và tư liệu báo chí về họ Nguyễn Nhuận, hậu duệ Thủy tổ Nguyễn Hữu Chỉ.</p>
        </div>
        {isAdmin && (
          <Link
            to="/admin?tab=posts"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#8B2323] text-white rounded-xl font-bold hover:bg-[#6B1B1B] transition-colors shadow-lg shadow-[#8B2323]/20 self-start"
          >
            <PenSquare className="w-4 h-4" /> Quản lý bài viết
          </Link>
        )}
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="w-12 h-12 border-4 border-[#8B2323] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-[#E5E1D8]">
          <Newspaper className="w-14 h-14 mx-auto mb-4 text-[#A19D96] opacity-30" />
          <p className="text-[#A19D96]">Chưa có bài viết nào.</p>
        </div>
      ) : (
        <>
          {featured && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Link
                to={`/thong-tin/${featured.id}`}
                className="group grid md:grid-cols-2 bg-white rounded-[32px] border border-[#E5E1D8] overflow-hidden shadow-sm hover:shadow-xl hover:border-[#8B2323]/30 transition-all"
              >
                <Cover post={featured} className="w-full h-64 md:h-full md:min-h-[360px]" />
                <div className="p-8 md:p-10 flex flex-col gap-4 justify-center">
                  <div className="flex items-center gap-2">
                    <KindBadge post={featured} />
                    {featured.pinned && <Pin className="w-4 h-4 text-[#8B2323]" />}
                    {!featured.published && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">Bản nháp</span>}
                  </div>
                  <h2 className="font-serif text-3xl md:text-4xl font-bold leading-tight text-[#2D2A26] group-hover:text-[#8B2323] transition-colors">
                    {featured.title}
                  </h2>
                  {featured.summary && <p className="text-[#6B665F] leading-relaxed line-clamp-4">{featured.summary}</p>}
                  <Meta post={featured} />
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-[#8B2323]">
                    {featured.kind === "link" ? "Xem tóm tắt và bài gốc" : "Đọc bài viết"} <ArrowUpRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          )}

          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.05 }}>
                  <Link
                    to={`/thong-tin/${p.id}`}
                    className="group flex flex-col h-full bg-white rounded-3xl border border-[#E5E1D8] overflow-hidden shadow-sm hover:shadow-lg hover:border-[#8B2323]/30 transition-all"
                  >
                    <Cover post={p} className="w-full h-48" />
                    <div className="p-6 flex flex-col gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <KindBadge post={p} />
                        {p.pinned && <Pin className="w-3.5 h-3.5 text-[#8B2323]" />}
                        {!p.published && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">Bản nháp</span>}
                      </div>
                      <h3 className="font-serif text-xl font-bold leading-snug text-[#2D2A26] group-hover:text-[#8B2323] transition-colors">{p.title}</h3>
                      {p.summary && <p className="text-sm text-[#6B665F] leading-relaxed line-clamp-3 flex-1">{p.summary}</p>}
                      <Meta post={p} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default News;
