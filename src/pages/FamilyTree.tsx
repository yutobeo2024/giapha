import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Filter, ChevronRight, User as UserIcon, Info, X, ZoomIn, ZoomOut, Maximize, MousePointer2, FileDown } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useSearchParams } from "react-router-dom";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { FamilyMember } from "../types";
import { avatarUrl } from "../lib/avatar";
import { useMembers } from "../hooks/useMembers";
import { parentLabel, treeParents } from "../lib/lineage";
import { foldText } from "../lib/text";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sơ đồ cây mặc định mở các nhánh đến hết đời này; đời sâu hơn bấm để mở */
const OPEN_TO_GEN = 10;
/** Chế độ danh sách: số người hiện trước ở mỗi đời */
const GRID_PAGE = 24;

const FamilyTree: React.FC = () => {
  const { members, loading, error } = useMembers();
  const [gridLimit, setGridLimit] = useState<Record<number, number>>({});
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const modalRef = React.useRef<HTMLDivElement>(null);
  // Bấm sang cha/con/anh em trong khung chi tiết: cuộn khung về đầu để thấy tên người mới
  useEffect(() => {
    modalRef.current?.scrollTo({ top: 0 });
  }, [selectedMember?.id]);

  useEffect(() => {
    if (!highlightId || members.length === 0) return;
    const highlighted = members.find(m => m.id === highlightId);
    if (highlighted) {
      setSelectedMember(highlighted);
      revealMember(highlighted.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, members]);

  // Người đứng trên mỗi người (cha, không thì mẹ); dữ liệu lỗi có vòng lặp đã được cắt sẵn
  const parents = useMemo(() => treeParents(members), [members]);
  // Con của từng người, tính một lần (cây có hơn 1.500 người)
  const childrenOf = useMemo(() => {
    const map = new Map<string, FamilyMember[]>();
    for (const m of members) {
      const p = parents.get(m.id);
      if (!p) continue;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(m);
    }
    return map;
  }, [members, parents]);
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  // Gốc cây: người không có cha mẹ trong danh sách (bất kể đời, kể cả khi cha đã bị xóa), để nhánh chưa nối vẫn hiển thị.
  const roots = members.filter(m => !parents.get(m.id));

  // Nhánh đang mở: mặc định mở đến đời OPEN_TO_GEN; bấm vào nút dưới mỗi người để mở/đóng nhánh con.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const isOpen = (m: FamilyMember) => (expanded.has(m.id) || m.generation < OPEN_TO_GEN) && !collapsed.has(m.id);
  const toggleOpen = (m: FamilyMember) => {
    const open = isOpen(m);
    setExpanded(prev => {
      const next = new Set(prev);
      if (open) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
    setCollapsed(prev => {
      const next = new Set(prev);
      if (open) next.add(m.id);
      else next.delete(m.id);
      return next;
    });
  };
  /** Mở mọi nhánh tổ tiên của một người để người đó hiện trên sơ đồ */
  const revealMember = (id: string) => {
    const chain: string[] = [];
    for (let p = parents.get(id); p; p = parents.get(p)) chain.push(p);
    if (!chain.length) return;
    setExpanded(prev => new Set([...prev, ...chain]));
    setCollapsed(prev => {
      const next = new Set(prev);
      chain.forEach(c => next.delete(c));
      return next;
    });
  };

  const filteredMembers = members.filter(m => {
    return foldText(m.name).includes(foldText(searchTerm));
  });

  useEffect(() => {
    if (highlightId && !loading) {
      const timer = setTimeout(() => {
        const element = document.querySelector(`[data-member-id="${highlightId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading]);

  const generations = Array.from(new Set(members.map(m => m.generation))).sort((a, b) => a - b);

  /** Bản in nhiều tờ thì hỏi trước (in rồi ghép lại) */
  const confirmPages = (pages: number) =>
    pages <= 12 || window.confirm(`Bản in cần ${pages} tờ A3, in xong ghép lại theo số tờ. Vẫn xuất?`);

  /** Không truyền `branch`: in phần cây đang mở trên màn hình; có `branch`: in người đó và toàn bộ con cháu */
  const exportPdf = async (branch?: FamilyMember) => {
    setExporting(true);
    try {
      // Thư viện PDF và font chỉ tải khi bấm xuất
      const { exportTreePdf, slugName } = await import("../lib/treePdf");
      const kids = (m: FamilyMember) => childrenOf.get(m.id) || [];
      await exportTreePdf(
        branch
          ? {
              roots: [branch],
              shown: kids,
              subtitle: `Nhánh ${branch.name} (đời ${branch.generation})`,
              fileName: `Gia-Pha-Nhanh-${slugName(branch.name)}.pdf`,
              confirmPages,
            }
          : {
              roots,
              shown: (m) => (isOpen(m) ? kids(m) : []),
              total: (m) => kids(m).length,
              subtitle: "Phần cây đang mở trên màn hình",
              fileName: "Gia-Pha-Ho-Nguyen-Nhuan.pdf",
              confirmPages,
            }
      );
    } catch (error) {
      console.error("Export PDF failed:", error);
      alert("Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  /** Số con cháu của một người (để ghi trên nút xuất nhánh) */
  const countDescendants = (m: FamilyMember) => {
    let n = 0;
    const seen = new Set<string>([m.id]);
    const stack = [...(childrenOf.get(m.id) || [])];
    while (stack.length) {
      const c = stack.pop()!;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      n++;
      stack.push(...(childrenOf.get(c.id) || []));
    }
    return n;
  };

  // Recursive component for Tree View
  const MemberNode = ({ member, level = 0 }: { member: FamilyMember; level: number }) => {
    const children = childrenOf.get(member.id) || [];
    const hasChildren = children.length > 0;
    const open = hasChildren && isOpen(member);
    const isHighlighted = member.id === highlightId;
    const isSearchMatch = searchTerm && foldText(member.name).includes(foldText(searchTerm));

    return (
      <div className="flex flex-col items-center">
        <motion.div
          data-member-id={member.id}
          onClick={() => setSelectedMember(member)}
          whileHover={{ y: -2, scale: 1.02 }}
          className={cn(
            "relative z-10 bg-white p-2.5 rounded-lg border border-[#E5E1D8] shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-[#8B2323]/30 w-[140px]",
            member.gender === "Nam" ? "border-t-2 border-t-blue-400" : "border-t-2 border-t-pink-400",
            isHighlighted && "ring-2 ring-[#8B2323] ring-offset-1 border-[#8B2323] shadow-lg shadow-[#8B2323]/20",
            isSearchMatch && "ring-2 ring-emerald-500 ring-offset-1 border-emerald-500 shadow-lg shadow-emerald-500/20"
          )}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative">
              <img
                src={member.photoUrl || avatarUrl(member.name, { gender: member.gender })}
                alt={member.name}
                loading="lazy"
                className="w-10 h-10 rounded-full object-cover border border-white shadow-sm"
              />
              {member.status === "Deceased" && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-800 rounded-full flex items-center justify-center border border-white">
                  <div className="w-1 h-1 bg-white/50 rounded-full" />
                </div>
              )}
            </div>
            <div className="text-center overflow-hidden w-full">
              <h4 className="font-bold text-[#2D2A26] text-[11px] leading-tight truncate">{member.name}</h4>
              <p className="text-[9px] text-[#A19D96] mt-0.5">Thế hệ {member.generation}</p>
            </div>
          </div>
        </motion.div>

        {hasChildren && (
          <button
            type="button"
            onClick={() => toggleOpen(member)}
            data-toggle-branch={member.id}
            className="relative z-10 mt-1.5 px-2 py-0.5 rounded-full border border-[#E5E1D8] bg-white text-[10px] font-bold text-[#8B2323] hover:bg-[#8B2323]/5"
            aria-expanded={open}
          >
            {open ? "Thu gọn" : `+ ${children.length} con`}
          </button>
        )}

        {open && (
          <div className="relative pt-6 flex flex-col items-center">
            {/* Vertical line from parent to horizontal line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-6 bg-[#D1CDC2]" />
            
            <div className="flex gap-10 relative">
              {children.map((child, index) => (
                <div key={child.id} className="relative pt-6 flex-1">
                  {/* Horizontal line segments */}
                  {children.length > 1 && (
                    <div 
                      className={cn(
                        "absolute top-0 h-[1.5px] bg-[#D1CDC2]",
                        index === 0 ? "left-1/2 -right-5" : 
                        index === children.length - 1 ? "-left-5 right-1/2" : 
                        "-left-5 -right-5"
                      )}
                    />
                  )}
                  {/* Vertical line from horizontal line to child */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-6 bg-[#D1CDC2]" />
                  <MemberNode member={child} level={level + 1} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">{error}</div>
      )}
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">Cây Gia Phả</h1>
          <p className="text-[#6B665F]">Khám phá các thế hệ trong dòng họ Nguyễn Nhuận.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {viewMode === "tree" && (
            <button
              onClick={() => exportPdf()}
              disabled={exporting}
              title="Xuất phần cây đang mở trên màn hình; cây rộng sẽ chia thành nhiều tờ A3 để ghép"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Xuất PDF (A3)
            </button>
          )}
          <div className="flex bg-white border border-[#E5E1D8] rounded-full p-1">
            <button
              onClick={() => setViewMode("tree")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                viewMode === "tree" ? "bg-[#8B2323] text-white shadow-md" : "text-[#6B665F] hover:bg-gray-50"
              )}
            >
              Sơ đồ cây
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                viewMode === "grid" ? "bg-[#8B2323] text-white shadow-md" : "text-[#6B665F] hover:bg-gray-50"
              )}
            >
              Danh sách
            </button>
          </div>
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A19D96]" />
            <input
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-[#E5E1D8] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20 w-full md:w-64"
            />
            {searchTerm && filteredMembers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E1D8] rounded-2xl shadow-xl z-[100] max-h-64 overflow-y-auto p-2">
                {filteredMembers.slice(0, 40).map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMember(m);
                      setSearchTerm("");
                      // Mở nhánh chứa người này rồi cuộn tới
                      revealMember(m.id);
                      setTimeout(() => {
                        document.querySelector(`[data-member-id="${m.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
                      }, 300);
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors text-left"
                  >
                    <img
                      src={m.photoUrl || avatarUrl(m.name, { gender: m.gender })}
                      alt=""
                      className="w-8 h-8 rounded-full border border-gray-100 object-cover"
                    />
                    <div>
                      <div className="text-sm font-bold text-[#2D2A26]">{m.name}</div>
                      <div className="text-[10px] text-[#A19D96]">
                        Đời {m.generation}
                        {parentLabel(m, byId) ? ` · ${parentLabel(m, byId)}` : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tree View Container */}
      <div className="bg-[#FDFCF9] rounded-3xl border border-[#E5E1D8] overflow-hidden min-h-[700px] shadow-inner relative group">
        {loading ? (
          <div className="flex items-center justify-center h-[700px]">
            <div className="w-12 h-12 border-4 border-[#8B2323]/20 border-t-[#8B2323] rounded-full animate-spin" />
          </div>
        ) : viewMode === "tree" ? (
          <TransformWrapper
            initialScale={0.8}
            minScale={0.2}
            maxScale={2}
            centerOnInit
            limitToBounds={false}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Zoom Controls */}
                <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
                  <button
                    onClick={() => zoomIn()}
                    className="p-3 bg-white border border-[#E5E1D8] rounded-xl shadow-lg hover:bg-gray-50 text-[#8B2323] transition-all active:scale-95"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => zoomOut()}
                    className="p-3 bg-white border border-[#E5E1D8] rounded-xl shadow-lg hover:bg-gray-50 text-[#8B2323] transition-all active:scale-95"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => resetTransform()}
                    className="p-3 bg-white border border-[#E5E1D8] rounded-xl shadow-lg hover:bg-gray-50 text-[#8B2323] transition-all active:scale-95"
                    title="Về mặc định"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>

                {/* Helper Tooltip */}
                <div className="absolute top-6 left-6 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs flex items-center gap-2">
                    <MousePointer2 className="w-3 h-3" />
                    Giữ chuột trái để kéo • Cuộn chuột để thu phóng
                  </div>
                </div>

                <TransformComponent wrapperClass="!w-full !h-[700px]" contentClass="!w-full !h-full flex items-center justify-center">
                  <div className="p-20 inline-block bg-[#FDFCF9]">
                    <div className="flex flex-col items-center gap-16">
                      {roots.map(ancestor => (
                        <div key={ancestor.id} className="mb-16 last:mb-0">
                          <MemberNode member={ancestor} level={0} />
                        </div>
                      ))}
                      {roots.length === 0 && (
                        <div className="text-center py-20">
                          <Users className="w-16 h-16 mx-auto mb-4 text-[#A19D96] opacity-20" />
                          <p className="text-[#A19D96]">Vui lòng thiết lập cha/mẹ cho các thành viên để hiển thị sơ đồ cây.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
          <div className="p-8 space-y-12 overflow-y-auto max-h-[700px]">
            {generations.map((gen) => (
              <div key={gen} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#8B2323] text-white flex items-center justify-center font-serif text-xl shadow-md">
                    {gen}
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#8B2323]">Thế hệ thứ {gen}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredMembers.filter(m => m.generation === gen).slice(0, gridLimit[gen] ?? GRID_PAGE).map((member) => (
                    <motion.div
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      whileHover={{ y: -4, scale: 1.02 }}
                      className={cn(
                        "bg-white p-5 rounded-2xl border border-[#E5E1D8] shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-[#8B2323]/30",
                        member.gender === "Nam" ? "border-l-4 border-l-blue-400" : "border-l-4 border-l-pink-400"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={member.photoUrl || avatarUrl(member.name, { gender: member.gender })}
                          alt=""
                          loading="lazy"
                          className="w-12 h-12 rounded-full object-cover border border-[#E5E1D8]"
                        />
                        <div>
                          <h4 className="font-bold text-[#2D2A26]">{member.name}</h4>
                          <p className="text-xs text-[#A19D96]">Thế hệ {member.generation}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {(() => {
                  const total = filteredMembers.filter(m => m.generation === gen).length;
                  const shown = Math.min(total, gridLimit[gen] ?? GRID_PAGE);
                  return shown < total ? (
                    <button
                      type="button"
                      onClick={() => setGridLimit(prev => ({ ...prev, [gen]: shown + GRID_PAGE * 4 }))}
                      className="px-5 py-2 rounded-full border border-[#E5E1D8] bg-white text-sm font-bold text-[#8B2323] hover:bg-[#8B2323]/5"
                    >
                      Xem thêm ({total - shown} người)
                    </button>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            {/* Không dùng layoutId chung với ô trên cây: ô nằm trong vùng phóng/thu nên khung bị đặt sai chỗ */}
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 bottom-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] bg-white rounded-3xl shadow-2xl z-[70]"
            >
              <div className="relative h-32 bg-[#8B2323]">
                <button
                  onClick={() => setSelectedMember(null)}
                  aria-label="Đóng"
                  className="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative px-8 pb-8 -mt-16">
                <div className="flex flex-col items-center text-center">
                  <img
                    src={selectedMember.photoUrl || avatarUrl(selectedMember.name, { gender: selectedMember.gender, size: 256 })}
                    alt={selectedMember.name}
                    className="w-32 h-32 rounded-full border-4 border-white shadow-xl object-cover mb-4"
                  />
                  <h2 className="text-3xl font-serif font-bold text-[#2D2A26]">{selectedMember.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      selectedMember.gender === "Nam" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                    )}>
                      {selectedMember.gender}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider">
                      Thế hệ {selectedMember.generation}
                    </span>
                  </div>
                </div>

                <div className="mt-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#FDFCF9] rounded-2xl border border-[#E5E1D8]">
                      <div className="text-xs text-[#A19D96] uppercase font-bold mb-1">Ngày sinh</div>
                      <div className="font-medium">{selectedMember.birthDate || "Chưa cập nhật"}</div>
                    </div>
                    <div className="p-4 bg-[#FDFCF9] rounded-2xl border border-[#E5E1D8]">
                      <div className="text-xs text-[#A19D96] uppercase font-bold mb-1">Ngày mất</div>
                      <div className="font-medium">{selectedMember.deathDate || "---"}</div>
                    </div>
                    <div className="p-4 bg-[#FDFCF9] rounded-2xl border border-[#E5E1D8] col-span-2">
                      <div className="text-xs text-[#A19D96] uppercase font-bold mb-1">Nơi sống</div>
                      <div className="font-medium">{selectedMember.address || "Chưa cập nhật"}</div>
                    </div>
                  </div>

                  {selectedMember.biography && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#8B2323]">
                        <Info className="w-4 h-4" />
                        Tiểu sử
                      </div>
                      <p className="text-[#6B665F] text-sm leading-relaxed italic">
                        "{selectedMember.biography}"
                      </p>
                    </div>
                  )}

                  {(childrenOf.get(selectedMember.id)?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => exportPdf(selectedMember)}
                      disabled={exporting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {exporting ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                      Xuất PDF nhánh này ({countDescendants(selectedMember) + 1} người)
                    </button>
                  )}

                  {/* Relationships Section */}
                  <div className="space-y-4 pt-6 border-t border-[#E5E1D8]">
                    <h3 className="text-sm font-bold text-[#8B2323] uppercase tracking-wider">Quan hệ gia đình</h3>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Parents */}
                      {(selectedMember.fatherId || selectedMember.motherId) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-[#A19D96] uppercase">Cha mẹ</span>
                          <div className="flex flex-wrap gap-2">
                            {selectedMember.fatherId && (
                              <button 
                                onClick={() => setSelectedMember(members.find(m => m.id === selectedMember.fatherId) || null)}
                                className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium hover:bg-blue-100 transition-colors"
                              >
                                Cha: {members.find(m => m.id === selectedMember.fatherId)?.name}
                              </button>
                            )}
                            {selectedMember.motherId && (
                              <button 
                                onClick={() => setSelectedMember(members.find(m => m.id === selectedMember.motherId) || null)}
                                className="px-3 py-2 bg-pink-50 text-pink-700 rounded-xl text-xs font-medium hover:bg-pink-100 transition-colors"
                              >
                                Mẹ: {members.find(m => m.id === selectedMember.motherId)?.name}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Children */}
                      {members.some(m => m.fatherId === selectedMember.id || m.motherId === selectedMember.id) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-[#A19D96] uppercase">Con cái</span>
                          <div className="flex flex-wrap gap-2">
                            {members
                              .filter(m => m.fatherId === selectedMember.id || m.motherId === selectedMember.id)
                              .map(child => (
                                <button 
                                  key={child.id}
                                  onClick={() => setSelectedMember(child)}
                                  className="px-3 py-2 bg-gray-50 text-gray-700 border border-[#E5E1D8] rounded-xl text-xs font-medium hover:bg-white transition-colors"
                                >
                                  {child.name}
                                </button>
                              ))
                            }
                          </div>
                        </div>
                      )}

                      {/* Siblings */}
                      {selectedMember.fatherId && members.some(m => m.fatherId === selectedMember.fatherId && m.id !== selectedMember.id) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-[#A19D96] uppercase">Anh chị em</span>
                          <div className="flex flex-wrap gap-2">
                            {members
                              .filter(m => m.fatherId === selectedMember.fatherId && m.id !== selectedMember.id)
                              .map(sibling => (
                                <button 
                                  key={sibling.id}
                                  onClick={() => setSelectedMember(sibling)}
                                  className="px-3 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-medium hover:bg-white transition-colors border border-dashed border-[#E5E1D8]"
                                >
                                  {sibling.name}
                                </button>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FamilyTree;
