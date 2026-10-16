import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bold,
  Eye,
  EyeOff,
  FileText,
  Heading2,
  ImagePlus,
  Link2,
  Loader2,
  Newspaper,
  Pin,
  Plus,
  Save,
  Trash2,
  Edit2,
  X,
  Wand2,
  ExternalLink,
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { uploadPhoto } from "../../lib/image";
import { Markdown } from "../../lib/markdown";
import { fetchLinkPreview, formatPostDate, hostOf, importImage, slugify, sortPosts } from "../../lib/posts";
import type { Post, PostKind, PostSource } from "../../types";

type Message = { type: "success" | "error"; text: string };
type Draft = {
  kind: PostKind;
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverUrl: string;
  coverCaption: string;
  sources: PostSource[];
  eventDate: string;
  published: boolean;
  pinned: boolean;
};

const inputCls =
  "w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20";
const labelCls = "block text-xs font-bold uppercase text-[#A19D96] mb-2";

const emptyDraft = (kind: PostKind): Draft => ({
  kind,
  title: "",
  slug: "",
  summary: "",
  content: "",
  coverUrl: "",
  coverCaption: "",
  sources: [{ name: "", url: "" }],
  eventDate: new Date().toISOString().slice(0, 10),
  published: true,
  pinned: false,
});

interface Props {
  user: User;
  initialEditId?: string | null;
  setMessage: (m: Message | null) => void;
  logActivity: (action: string) => Promise<void>;
}

const PostsManager: React.FC<Props> = ({ user, initialEditId, setMessage, logActivity }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Post | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const openedInitial = useRef(false);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "posts"),
        (snap) => setPosts(sortPosts(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Post))),
        (err) => setMessage({ type: "error", text: handleFirestoreError(err, OperationType.LIST, "posts") })
      ),
    [setMessage]
  );

  const open = (post: Post | null, kind: PostKind = "article") => {
    setEditing(post);
    setPreview(false);
    setSlugTouched(!!post);
    setDraft(
      post
        ? {
            kind: post.kind,
            title: post.title,
            slug: post.id,
            summary: post.summary || "",
            content: post.content || "",
            coverUrl: post.coverUrl || "",
            coverCaption: post.coverCaption || "",
            sources: post.sources?.length ? post.sources : [{ name: "", url: "" }],
            eventDate: post.eventDate || "",
            published: post.published,
            pinned: !!post.pinned,
          }
        : emptyDraft(kind)
    );
  };

  // Mở thẳng bài cần sửa khi đến từ nút "Sửa bài" ở trang Thông tin
  useEffect(() => {
    if (openedInitial.current || !initialEditId || posts.length === 0) return;
    const p = posts.find((x) => x.id === initialEditId);
    if (p) {
      openedInitial.current = true;
      open(p);
    }
  }, [initialEditId, posts]);

  const close = () => {
    setDraft(null);
    setEditing(null);
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const slugTaken = useMemo(
    () => !!draft && !editing && posts.some((p) => p.id === (draft.slug || slugify(draft.title))),
    [draft, editing, posts]
  );

  // ---------- Soạn nội dung ----------
  const insert = (before: string, after = "", placeholder = "") => {
    const ta = contentRef.current;
    if (!ta || !draft) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    set("content", next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };

  const insertBlock = (block: string) => {
    const ta = contentRef.current;
    if (!draft) return;
    const pos = ta ? ta.selectionEnd : draft.content.length;
    const v = draft.content;
    const pre = v.slice(0, pos);
    const glue = pre && !pre.endsWith("\n\n") ? (pre.endsWith("\n") ? "\n" : "\n\n") : "";
    set("content", pre + glue + block + "\n\n" + v.slice(pos).replace(/^\n+/, ""));
  };

  const uploadInto = async (file: File, target: "cover" | "content") => {
    setBusy(target === "cover" ? "cover" : "image");
    try {
      // Ảnh bài viết hiển thị rộng hơn ảnh thành viên: giữ tới 1600px
      const url = await uploadPhoto(file, user, 1600);
      if (target === "cover") set("coverUrl", url);
      else insertBlock(`![Chú thích ảnh (nguồn ảnh)](${url})`);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Tải ảnh thất bại." });
    } finally {
      setBusy(null);
    }
  };

  const importInto = async (target: "cover" | "content") => {
    const url = window.prompt("Dán đường dẫn ảnh (https://...) để chép về kho ảnh của site:");
    if (!url) return;
    setBusy(target === "cover" ? "cover" : "image");
    try {
      const res = await importImage(url.trim(), user, draft?.sources[0]?.url || undefined);
      if (target === "cover") set("coverUrl", res.url);
      else insertBlock(`![Chú thích ảnh (Ảnh: ${hostOf(url)})](${res.url})`);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Không chép được ảnh." });
    } finally {
      setBusy(null);
    }
  };

  // Bài dạng liên kết: đọc tiêu đề, tóm tắt, ảnh từ bài báo
  const autofill = async () => {
    const src = draft?.sources[0]?.url?.trim();
    if (!src) return setMessage({ type: "error", text: "Nhập đường dẫn bài gốc trước." });
    setBusy("preview");
    try {
      const p = await fetchLinkPreview(src, user);
      let cover = draft?.coverUrl || "";
      if (!cover && p.image) {
        cover = await importImage(p.image, user, p.url).then((r) => r.url).catch(() => p.image || "");
      }
      setDraft((d) =>
        d
          ? {
              ...d,
              title: d.title || p.title || "",
              summary: d.summary || p.description || "",
              coverUrl: cover,
              coverCaption: d.coverCaption || (cover ? `Ảnh: ${p.siteName || hostOf(p.url)}` : ""),
              eventDate: p.publishedTime && /^\d{4}-\d{2}-\d{2}/.test(p.publishedTime) ? p.publishedTime.slice(0, 10) : d.eventDate,
              sources: [{ name: d.sources[0]?.name || p.siteName || hostOf(p.url), url: p.url }, ...d.sources.slice(1)],
            }
          : d
      );
      setMessage({ type: "success", text: "Đã lấy thông tin từ bài gốc. Kiểm tra lại trước khi lưu." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Không đọc được bài gốc." });
    } finally {
      setBusy(null);
    }
  };

  // ---------- Lưu ----------
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const id = editing ? editing.id : draft.slug || slugify(draft.title);
    if (!id) return setMessage({ type: "error", text: "Thiếu tiêu đề." });
    if (slugTaken) return setMessage({ type: "error", text: "Đường dẫn bài đã tồn tại, hãy đổi đường dẫn." });
    const sources = draft.sources.map((s) => ({ name: s.name.trim(), url: s.url.trim() })).filter((s) => s.name || s.url);
    if (draft.kind === "link" && !sources[0]?.url) return setMessage({ type: "error", text: "Bài dạng liên kết cần đường dẫn bài gốc." });

    const now = new Date().toISOString();
    const data: Record<string, unknown> = {
      kind: draft.kind,
      title: draft.title.trim(),
      published: draft.published,
      pinned: draft.pinned,
      sources,
      updatedAt: now,
      createdAt: editing?.createdAt || now,
      authorName: editing?.authorName || user.displayName || user.email || "Quản trị viên",
    };
    for (const k of ["summary", "content", "coverUrl", "coverCaption", "eventDate"] as const) {
      const v = draft[k].trim();
      if (v) data[k] = v;
    }

    setBusy("save");
    try {
      // setDoc ghi đè toàn bộ: trường bị xóa trắng sẽ mất đúng như mong muốn
      await setDoc(doc(db, "posts", id), data);
      await logActivity(`${editing ? "đã cập nhật" : "đã đăng"} bài Thông tin: ${data.title}`);
      setMessage({ type: "success", text: draft.published ? "Đã lưu và xuất bản bài." : "Đã lưu bản nháp." });
      close();
    } catch (err) {
      setMessage({ type: "error", text: handleFirestoreError(err, editing ? OperationType.UPDATE : OperationType.CREATE, "posts") });
    } finally {
      setBusy(null);
    }
  };

  const togglePublish = async (p: Post) => {
    try {
      await updateDoc(doc(db, "posts", p.id), { published: !p.published, updatedAt: new Date().toISOString() });
      await logActivity(`${p.published ? "đã ẩn" : "đã xuất bản"} bài Thông tin: ${p.title}`);
    } catch (err) {
      setMessage({ type: "error", text: handleFirestoreError(err, OperationType.UPDATE, "posts") });
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteDoc(doc(db, "posts", toDelete.id));
      await logActivity(`đã xóa bài Thông tin: ${toDelete.title}`);
      setMessage({ type: "success", text: "Đã xóa bài." });
    } catch (err) {
      setMessage({ type: "error", text: handleFirestoreError(err, OperationType.DELETE, "posts") });
    } finally {
      setToDelete(null);
    }
  };

  // ---------- Giao diện ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6B665F] max-w-2xl">
          Bài viết tự soạn (có ảnh, ghi nguồn) hoặc thẻ liên kết tới bài báo gốc. Chỉ quản trị viên thêm, sửa, xóa. Bài đã xuất bản hiện ở trang{" "}
          <a href="/thong-tin" className="text-[#8B2323] font-bold">
            Thông tin
          </a>
          .
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => open(null, "link")}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-[#E5E1D8] text-[#6B665F] rounded-xl font-bold hover:bg-gray-50 text-sm"
          >
            <Link2 className="w-4 h-4" /> Nhúng bài báo
          </button>
          <button
            onClick={() => open(null, "article")}
            className="flex items-center gap-2 px-5 py-3 bg-[#8B2323] text-white rounded-xl font-bold hover:bg-[#6B1B1B] shadow-lg shadow-[#8B2323]/20 text-sm"
          >
            <Plus className="w-4 h-4" /> Viết bài mới
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5E1D8] overflow-hidden shadow-sm">
        {posts.length === 0 ? (
          <div className="p-12 text-center text-[#A19D96]">Chưa có bài nào.</div>
        ) : (
          <ul className="divide-y divide-[#E5E1D8]">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0 bg-[#f1ede6]" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-[#8B2323]/10 flex items-center justify-center shrink-0">
                    {p.kind === "link" ? <Newspaper className="w-5 h-5 text-[#8B2323]" /> : <FileText className="w-5 h-5 text-[#8B2323]" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <a href={`/thong-tin/${p.id}`} className="font-bold text-[#2D2A26] hover:text-[#8B2323] line-clamp-1">
                    {p.pinned && <Pin className="inline w-3.5 h-3.5 mr-1 text-[#8B2323]" />}
                    {p.title}
                  </a>
                  <div className="text-xs text-[#A19D96] flex flex-wrap gap-x-3">
                    <span>{p.kind === "link" ? "Báo chí" : "Bài viết"}</span>
                    {p.eventDate && <span>{formatPostDate(p.eventDate)}</span>}
                    {p.sources?.[0] && <span>Nguồn: {p.sources[0].name || hostOf(p.sources[0].url)}</span>}
                  </div>
                </div>
                <span
                  className={`hidden sm:inline px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    p.published ? "bg-emerald-50 text-emerald-600" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {p.published ? "Đã xuất bản" : "Bản nháp"}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => togglePublish(p)} className="p-2 text-[#6B665F] hover:text-[#8B2323] rounded-lg" title={p.published ? "Ẩn bài" : "Xuất bản"}>
                    {p.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => open(p)} className="p-2 text-[#6B665F] hover:text-[#8B2323] rounded-lg" title="Sửa">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setToDelete(p)} className="p-2 text-[#6B665F] hover:text-red-600 rounded-lg" title="Xóa">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Trình soạn bài */}
      <AnimatePresence>
        {draft && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:top-6 md:bottom-6 md:w-[860px] bg-white rounded-3xl shadow-2xl z-[70] overflow-hidden flex flex-col"
            >
              <form onSubmit={save} className="flex flex-col min-h-0 h-full">
                <div className="px-6 md:px-8 py-5 flex justify-between items-center border-b border-[#E5E1D8] gap-4">
                  <h2 className="text-2xl font-serif font-bold">
                    {editing ? "Sửa bài" : draft.kind === "link" ? "Nhúng bài báo" : "Viết bài mới"}
                  </h2>
                  <button type="button" onClick={close} className="text-[#A19D96] hover:text-[#2D2A26]" aria-label="Đóng">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto overscroll-contain flex-grow space-y-6">
                  <div className="flex gap-2">
                    {(["article", "link"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set("kind", k)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-colors ${
                          draft.kind === k ? "bg-[#8B2323] text-white border-[#8B2323]" : "bg-white text-[#6B665F] border-[#E5E1D8]"
                        }`}
                      >
                        {k === "article" ? <FileText className="w-4 h-4" /> : <Newspaper className="w-4 h-4" />}
                        {k === "article" ? "Bài viết tự soạn" : "Liên kết bài báo"}
                      </button>
                    ))}
                  </div>

                  {draft.kind === "link" && (
                    <div>
                      <label className={labelCls}>Đường dẫn bài báo gốc</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={draft.sources[0]?.url || ""}
                          onChange={(e) => set("sources", [{ ...draft.sources[0], url: e.target.value }, ...draft.sources.slice(1)])}
                          placeholder="https://..."
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={autofill}
                          disabled={busy === "preview"}
                          className="shrink-0 inline-flex items-center gap-2 px-4 rounded-xl bg-[#2D2A26] text-white text-sm font-bold disabled:opacity-60"
                        >
                          {busy === "preview" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Lấy thông tin
                        </button>
                      </div>
                      <p className="text-[11px] text-[#A19D96] mt-2">Tự điền tiêu đề, tóm tắt, ảnh đại diện và ngày đăng từ bài gốc. Báo chí không cho nhúng nguyên trang, nên site hiện thẻ tóm tắt kèm nút đọc bài gốc.</p>
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Tiêu đề</label>
                    <input
                      required
                      value={draft.title}
                      onChange={(e) => {
                        set("title", e.target.value);
                        if (!slugTouched && !editing) set("slug", slugify(e.target.value));
                      }}
                      className={inputCls}
                    />
                    <div className="mt-2 flex items-center gap-2 text-xs text-[#A19D96]">
                      <span className="shrink-0">Đường dẫn: /thong-tin/</span>
                      <input
                        value={draft.slug}
                        disabled={!!editing}
                        onChange={(e) => {
                          setSlugTouched(true);
                          set("slug", slugify(e.target.value));
                        }}
                        className="flex-1 min-w-0 px-2 py-1 bg-transparent border-b border-dashed border-[#E5E1D8] focus:outline-none disabled:opacity-70"
                      />
                    </div>
                    {slugTaken && <p className="text-xs text-red-600 mt-1">Đường dẫn này đã có bài khác dùng.</p>}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelCls}>Ngày sự kiện / ngày đăng gốc</label>
                      <input type="date" value={draft.eventDate} onChange={(e) => set("eventDate", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex items-end gap-4 pb-2">
                      <label className="flex items-center gap-2 text-sm font-bold text-[#2D2A26]">
                        <input type="checkbox" checked={draft.published} onChange={(e) => set("published", e.target.checked)} className="w-4 h-4 accent-[#8B2323]" />
                        Xuất bản
                      </label>
                      <label className="flex items-center gap-2 text-sm font-bold text-[#2D2A26]">
                        <input type="checkbox" checked={draft.pinned} onChange={(e) => set("pinned", e.target.checked)} className="w-4 h-4 accent-[#8B2323]" />
                        Ghim lên đầu
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Tóm tắt (hiện ở danh sách và đầu bài)</label>
                    <textarea rows={3} value={draft.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} maxLength={1000} />
                  </div>

                  <div>
                    <label className={labelCls}>Ảnh bìa</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="w-full sm:w-44 h-28 rounded-2xl border-2 border-dashed border-[#E5E1D8] bg-[#FDFCF9] overflow-hidden flex items-center justify-center shrink-0 relative">
                        {draft.coverUrl ? <img src={draft.coverUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ImagePlus className="w-8 h-8 text-[#A19D96] opacity-40" />}
                        {busy === "cover" && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-[#8B2323]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E1D8] rounded-xl text-xs font-bold text-[#6B665F] cursor-pointer hover:bg-gray-50">
                            <ImagePlus className="w-4 h-4" /> Tải ảnh lên
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) uploadInto(f, "cover");
                              }}
                            />
                          </label>
                          <button type="button" onClick={() => importInto("cover")} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E1D8] rounded-xl text-xs font-bold text-[#6B665F] hover:bg-gray-50">
                            <Link2 className="w-4 h-4" /> Chép ảnh từ link
                          </button>
                          {draft.coverUrl && (
                            <button type="button" onClick={() => set("coverUrl", "")} className="px-3 py-2 text-xs font-bold text-red-600">
                              Gỡ ảnh
                            </button>
                          )}
                        </div>
                        <input value={draft.coverCaption} onChange={(e) => set("coverCaption", e.target.value)} placeholder="Chú thích ảnh bìa, ghi nguồn ảnh (VD: Ảnh: honguyenvietnam.org)" className={inputCls} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={labelCls + " mb-0"}>{draft.kind === "link" ? "Ghi chú thêm (không bắt buộc)" : "Nội dung"}</label>
                      <button type="button" onClick={() => setPreview((v) => !v)} className="text-xs font-bold text-[#8B2323] inline-flex items-center gap-1">
                        {preview ? <Edit2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {preview ? "Soạn tiếp" : "Xem trước"}
                      </button>
                    </div>
                    {preview ? (
                      <div className="min-h-[300px] p-5 rounded-xl border border-[#E5E1D8]">
                        {draft.content.trim() ? <Markdown source={draft.content} /> : <p className="text-[#A19D96] text-sm">Chưa có nội dung.</p>}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1 p-1.5 border border-b-0 border-[#E5E1D8] rounded-t-xl bg-[#FDFCF9]">
                          <button type="button" onClick={() => insert("**", "**", "chữ đậm")} className="p-2 rounded-lg hover:bg-white" title="Chữ đậm">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => insertBlock("## Tiêu đề mục")} className="p-2 rounded-lg hover:bg-white" title="Tiêu đề mục">
                            <Heading2 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => insert("[", "](https://)", "chữ liên kết")} className="p-2 rounded-lg hover:bg-white" title="Liên kết">
                            <Link2 className="w-4 h-4" />
                          </button>
                          <label className="p-2 rounded-lg hover:bg-white cursor-pointer inline-flex items-center gap-1 text-xs font-bold text-[#6B665F]" title="Chèn ảnh từ máy">
                            {busy === "image" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Ảnh
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) uploadInto(f, "content");
                              }}
                            />
                          </label>
                          <button type="button" onClick={() => importInto("content")} className="p-2 rounded-lg hover:bg-white inline-flex items-center gap-1 text-xs font-bold text-[#6B665F]" title="Chép ảnh từ đường dẫn">
                            <ExternalLink className="w-4 h-4" /> Ảnh từ link
                          </button>
                        </div>
                        <textarea
                          ref={contentRef}
                          rows={14}
                          value={draft.content}
                          onChange={(e) => set("content", e.target.value)}
                          className={inputCls + " rounded-t-none font-mono text-sm leading-relaxed"}
                          placeholder={"Viết nội dung. Cách trình bày:\n## Tiêu đề mục\n**chữ đậm**, [chữ liên kết](https://...)\n- gạch đầu dòng\n> trích dẫn\n![Chú thích ảnh (nguồn ảnh)](đường dẫn ảnh)  (nhiều ảnh liền nhau thành bộ ảnh)\nDán link YouTube một mình một dòng để nhúng video."}
                        />
                      </>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Nguồn tham khảo {draft.kind === "link" ? "(nguồn đầu là bài được nhúng)" : "(bắt buộc ghi rõ khi dùng tư liệu báo chí)"}</label>
                    <div className="space-y-2">
                      {draft.sources.map((s, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={s.name}
                            onChange={(e) => set("sources", draft.sources.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                            placeholder="Tên nguồn (VD: Họ Nguyễn Việt Nam)"
                            className={inputCls + " sm:w-1/3"}
                          />
                          <input
                            value={s.url}
                            onChange={(e) => set("sources", draft.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                            placeholder="https://..."
                            className={inputCls}
                          />
                          <button
                            type="button"
                            onClick={() => set("sources", draft.sources.length > 1 ? draft.sources.filter((_, j) => j !== i) : [{ name: "", url: "" }])}
                            className="px-2 text-[#A19D96] hover:text-red-600"
                            aria-label="Bỏ nguồn"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => set("sources", [...draft.sources, { name: "", url: "" }])} className="text-xs font-bold text-[#8B2323] inline-flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Thêm nguồn
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-6 md:px-8 py-4 border-t border-[#E5E1D8] flex gap-3 bg-[#FDFCF9]">
                  <button type="button" onClick={close} className="flex-1 py-3 bg-white border border-[#E5E1D8] rounded-xl font-bold text-[#6B665F]">
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="flex-[2] py-3 bg-[#8B2323] text-white rounded-xl font-bold hover:bg-[#6B1B1B] disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {busy === "save" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {draft.published ? "Lưu và xuất bản" : "Lưu bản nháp"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Xác nhận xóa */}
      <AnimatePresence>
        {toDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setToDelete(null)} className="fixed inset-0 bg-black/40 z-[80]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-md bg-white rounded-3xl p-8 shadow-2xl z-[90]"
            >
              <h3 className="font-serif text-2xl font-bold mb-3">Xóa bài này?</h3>
              <p className="text-[#6B665F] mb-6">
                “{toDelete.title}” sẽ bị xóa vĩnh viễn. Nếu chỉ muốn tạm ẩn, hãy dùng nút ẩn bài.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setToDelete(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-[#6B665F]">
                  Hủy
                </button>
                <button onClick={remove} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">
                  Xóa
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PostsManager;
