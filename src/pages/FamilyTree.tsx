import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Filter, ChevronRight, User as UserIcon, Info, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FamilyMember {
  id: string;
  name: string;
  birthDate?: string;
  deathDate?: string;
  gender: "Nam" | "Nữ";
  generation: number;
  branch?: string;
  role?: string;
  biography?: string;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  photoUrl?: string;
  status?: "Alive" | "Deceased";
}

const FamilyTree: React.FC = () => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");

  useEffect(() => {
    const q = query(collection(db, "members"), orderBy("generation", "asc"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyMember));
      setMembers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "members");
    });
    return () => unsubscribe();
  }, []);

  const filteredMembers = members.filter(m => {
    return m.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const generations = Array.from(new Set(members.map(m => m.generation))).sort((a, b) => a - b);

  // Recursive component for Tree View
  const MemberNode = ({ member, level = 0 }: { member: FamilyMember; level: number }) => {
    const children = members.filter(m => m.fatherId === member.id || m.motherId === member.id);
    const hasChildren = children.length > 0;

    return (
      <div className="flex flex-col items-center">
        <motion.div
          layoutId={member.id}
          onClick={() => setSelectedMember(member)}
          whileHover={{ y: -4, scale: 1.02 }}
          className={cn(
            "relative z-10 bg-white p-4 rounded-xl border border-[#E5E1D8] shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-[#8B2323]/30 min-w-[160px] max-w-[200px]",
            member.gender === "Nam" ? "border-t-4 border-t-blue-400" : "border-t-4 border-t-pink-400"
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <img
                src={member.photoUrl || `https://ui-avatars.com/api/?name=${member.name}&background=${member.gender === "Nam" ? "EBF5FF" : "FFF5F7"}&color=${member.gender === "Nam" ? "2563EB" : "DB2777"}`}
                alt={member.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
              />
              {member.status === "Deceased" && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center border-2 border-white">
                  <div className="w-1.5 h-1.5 bg-white/50 rounded-full" />
                </div>
              )}
            </div>
            <div className="text-center overflow-hidden w-full">
              <h4 className="font-bold text-[#2D2A26] text-sm truncate">{member.name}</h4>
              <p className="text-[10px] text-[#A19D96] mt-0.5">Thế hệ {member.generation}</p>
            </div>
          </div>
        </motion.div>

        {hasChildren && (
          <div className="relative pt-8 flex flex-col items-center">
            {/* Vertical line from parent to horizontal line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-8 bg-[#E5E1D8]" />
            
            <div className="flex gap-8 relative">
              {children.map((child, index) => (
                <div key={child.id} className="relative pt-8">
                  {/* Horizontal line segments - Connects to siblings without overhang */}
                  {children.length > 1 && (
                    <div 
                      className={cn(
                        "absolute top-0 h-px bg-[#E5E1D8]",
                        index === 0 ? "left-1/2 right-0" : 
                        index === children.length - 1 ? "left-0 right-1/2" : 
                        "left-0 right-0"
                      )}
                    />
                  )}
                  {/* Vertical line from horizontal line to child */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-8 bg-[#E5E1D8]" />
                  {/* Arrow head pointing to child - positioned near the card */}
                  <div className="absolute top-[26px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[#E5E1D8]" />
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
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">Cây Gia Phả</h1>
          <p className="text-[#6B665F]">Khám phá các thế hệ trong dòng họ Nguyễn Nhuận.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
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
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="bg-white rounded-3xl border border-[#E5E1D8] p-8 overflow-x-auto min-h-[600px] shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-[#8B2323]/20 border-t-[#8B2323] rounded-full animate-spin" />
          </div>
        ) : viewMode === "tree" ? (
          <div className="inline-block min-w-full text-center">
            <div className="flex flex-col items-center gap-12">
              {members.filter(m => !m.fatherId && !m.motherId && m.generation === 1).map(ancestor => (
                <div key={ancestor.id} className="mb-12 last:mb-0">
                  <MemberNode member={ancestor} level={0} />
                </div>
              ))}
              {members.filter(m => !m.fatherId && !m.motherId && m.generation === 1).length === 0 && (
                <div className="text-center py-20">
                  <Users className="w-16 h-16 mx-auto mb-4 text-[#A19D96] opacity-20" />
                  <p className="text-[#A19D96]">Vui lòng thiết lập cha/mẹ cho các thành viên để hiển thị sơ đồ cây.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {generations.map((gen) => (
              <div key={gen} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#8B2323] text-white flex items-center justify-center font-serif text-xl shadow-md">
                    {gen}
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#8B2323]">Thế hệ thứ {gen}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredMembers.filter(m => m.generation === gen).map((member) => (
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
                          src={member.photoUrl || `https://ui-avatars.com/api/?name=${member.name}`}
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
            <motion.div
              layoutId={selectedMember.id}
              className="fixed inset-x-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] bg-white rounded-3xl shadow-2xl z-[70] overflow-hidden"
            >
              <div className="relative h-32 bg-[#8B2323]">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-8 pb-8 -mt-16">
                <div className="flex flex-col items-center text-center">
                  <img
                    src={selectedMember.photoUrl || `https://ui-avatars.com/api/?name=${selectedMember.name}&size=128`}
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

                  <div className="pt-6 border-t border-[#E5E1D8] flex gap-3">
                    <button className="flex-grow py-3 px-4 bg-[#8B2323] text-white rounded-xl font-bold hover:bg-[#6B1B1B] transition-colors">
                      Xem quan hệ gia đình
                    </button>
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
