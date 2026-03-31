import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Filter, 
  User, 
  ChevronRight, 
  MapPin, 
  Calendar, 
  Users, 
  Heart,
  UserPlus,
  ArrowRight,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface Member {
  id: string;
  name: string;
  generation: number;
  birthDate?: string;
  deathDate?: string;
  address?: string;
  photoUrl?: string;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  bio?: string;
  gender: "Nam" | "Nữ";
  isDirectDescendant: boolean;
  status: "Sống" | "Mất";
  branch?: string;
}

const MemberList: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGeneration, setSelectedGeneration] = useState<number | "all">("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => {
    const q = query(collection(db, "members"), orderBy("generation", "asc"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(membersData);
      if (membersData.length > 0 && !selectedMember) {
        setSelectedMember(membersData[0]);
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "members"));

    return () => unsubscribe();
  }, []);

  const generations = useMemo(() => {
    const gens = Array.from(new Set(members.map(m => m.generation))).sort((a, b) => a - b);
    return gens;
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (m.address && m.address.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesGen = selectedGeneration === "all" || m.generation === selectedGeneration;
      return matchesSearch && matchesGen;
    });
  }, [members, searchTerm, selectedGeneration]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-[#8B2323] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2D2A26]">Danh Sách Thành Viên</h1>
          <p className="text-[#A19D96] text-sm mt-1">Tìm kiếm và xem thông tin chi tiết các thành viên trong dòng tộc.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-grow sm:w-64">
            <input 
              type="text" 
              placeholder="Tìm tên, địa chỉ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#E5E1D8] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A19D96]" />
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-[#E5E1D8] rounded-2xl">
            <Filter className="w-4 h-4 text-[#8B2323]" />
            <select 
              value={selectedGeneration}
              onChange={(e) => setSelectedGeneration(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-[#2D2A26] focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả đời</option>
              {generations.map(gen => (
                <option key={gen} value={gen}>Đời thứ {gen}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Generation Tabs (Visual) */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
        <button 
          onClick={() => setSelectedGeneration("all")}
          className={`px-6 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedGeneration === "all" ? "bg-[#8B2323] text-white shadow-lg" : "bg-white text-[#6B665F] border border-[#E5E1D8] hover:bg-[#FDFCF9]"}`}
        >
          Tất cả
        </button>
        {generations.map(gen => (
          <button 
            key={gen}
            onClick={() => setSelectedGeneration(gen)}
            className={`px-6 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedGeneration === gen ? "bg-[#8B2323] text-white shadow-lg" : "bg-white text-[#6B665F] border border-[#E5E1D8] hover:bg-[#FDFCF9]"}`}
          >
            Đời {gen}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Member Grid */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredMembers.map((member) => (
                <motion.div
                  layout
                  key={member.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedMember(member)}
                  className={`cursor-pointer group relative p-5 rounded-[32px] border transition-all ${selectedMember?.id === member.id ? "bg-[#FDFCF9] border-[#8B2323] shadow-xl" : "bg-white border-[#E5E1D8] hover:border-[#8B2323]/30"}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <img 
                        src={member.photoUrl || `https://ui-avatars.com/api/?name=${member.name}&background=FDFCF9&color=8B2323`} 
                        alt={member.name} 
                        className="w-16 h-16 rounded-2xl object-cover border border-[#E5E1D8]"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${member.gender === "Nam" ? "bg-blue-500" : "bg-pink-500"}`}>
                        <User className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B2323]">Đời {member.generation}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${member.status === "Sống" ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500"}`}>
                          {member.status}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-[#2D2A26] mt-1 group-hover:text-[#8B2323] transition-colors">{member.name}</h3>
                      <p className="text-[10px] text-[#A19D96] font-medium mt-1">
                        {member.address || "Chưa cập nhật địa chỉ"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-[#E5E1D8]/50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#FDFCF9] border border-[#E5E1D8] flex items-center justify-center text-[10px] font-bold text-[#8B2323]">
                        {member.branch || "I"}
                      </div>
                      <span className="text-[10px] font-bold text-[#6B665F]">Chi tộc</span>
                    </div>
                    <button className="text-[10px] font-bold text-[#8B2323] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Hồ sơ <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {filteredMembers.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-[#E5E1D8]">
              <Users className="w-16 h-16 text-[#A19D96] opacity-20 mx-auto mb-4" />
              <p className="text-[#A19D96] font-medium">Không tìm thấy thành viên nào phù hợp.</p>
            </div>
          )}
        </div>

        {/* Right: Member Detail */}
        <div className="lg:col-span-5">
          <div className="sticky top-10">
            <AnimatePresence mode="wait">
              {selectedMember ? (
                <motion.div
                  key={selectedMember.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-[40px] border border-[#E5E1D8] overflow-hidden shadow-2xl"
                >
                  {/* Profile Header */}
                  <div className="relative h-40 bg-[#8B2323]">
                    <div className="absolute inset-0 opacity-10">
                      <img src="https://picsum.photos/seed/pattern/800/400" alt="pattern" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-16 left-8">
                      <div className="relative">
                        <img 
                          src={selectedMember.photoUrl || `https://ui-avatars.com/api/?name=${selectedMember.name}&size=200&background=FDFCF9&color=8B2323`} 
                          alt={selectedMember.name} 
                          className="w-32 h-32 rounded-[32px] border-8 border-white shadow-xl object-cover"
                        />
                        <div className="absolute bottom-2 right-2 bg-white p-2 rounded-xl shadow-lg border border-[#E5E1D8]">
                          <span className="text-sm font-black text-[#8B2323]">{selectedMember.generation}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-20 p-8 space-y-8">
                    <div>
                      <h2 className="font-serif text-3xl font-bold text-[#2D2A26]">{selectedMember.name}</h2>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs font-bold text-[#6B665F]">
                          <User className="w-3 h-3 text-[#8B2323]" /> {selectedMember.gender}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-[#6B665F]">
                          <UserPlus className="w-3 h-3 text-[#8B2323]" /> {selectedMember.isDirectDescendant ? "Con trưởng" : "Con thứ"}
                        </span>
                      </div>
                    </div>

                    {/* Bio/Intro */}
                    <div className="bg-[#FDFCF9] p-6 rounded-3xl border border-[#E5E1D8] relative">
                      <Info className="absolute top-4 right-4 w-5 h-5 text-[#8B2323] opacity-20" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8B2323] mb-3">Tiểu sử & Gia tích</h4>
                      <p className="text-sm text-[#6B665F] leading-relaxed italic">
                        {selectedMember.bio || "Thông tin tiểu sử đang được cập nhật. Đây là nơi lưu giữ những câu chuyện, đóng góp và kỷ niệm về thành viên trong dòng họ."}
                      </p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#A19D96]">Ngày sinh</div>
                        <div className="flex items-center gap-2 text-sm font-bold text-[#2D2A26]">
                          <Calendar className="w-4 h-4 text-[#8B2323]" />
                          {selectedMember.birthDate ? format(new Date(selectedMember.birthDate), "dd/MM/yyyy") : "Chưa rõ"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#A19D96]">Nơi ở</div>
                        <div className="flex items-center gap-2 text-sm font-bold text-[#2D2A26]">
                          <MapPin className="w-4 h-4 text-[#8B2323]" />
                          {selectedMember.address || "Chưa rõ"}
                        </div>
                      </div>
                    </div>

                    {/* Family Relations */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8B2323]">Quan hệ gia đình</h4>
                      <div className="grid gap-3">
                        <div className="flex items-center justify-between p-4 bg-white border border-[#E5E1D8] rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-[#8B2323] font-bold text-xs">P</div>
                            <div>
                              <div className="text-[9px] font-bold uppercase text-[#A19D96]">Phối ngẫu</div>
                              <div className="text-sm font-bold text-[#2D2A26]">Trần Thị Hiền</div>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[#A19D96]" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white border border-[#E5E1D8] rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">H</div>
                            <div>
                              <div className="text-[9px] font-bold uppercase text-[#A19D96]">Hậu duệ</div>
                              <div className="text-sm font-bold text-[#2D2A26]">5 Người con (3 Trai, 2 Gái)</div>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[#A19D96]" />
                        </div>
                      </div>
                    </div>

                    <button className="w-full py-4 bg-[#8B2323] text-white rounded-2xl font-bold text-sm shadow-xl shadow-[#8B2323]/20 hover:bg-[#6B1B1B] transition-all">
                      Xem Sơ Đồ Gia Hệ
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[40px] border border-[#E5E1D8] p-10 text-center">
                  <div className="w-24 h-24 bg-[#FDFCF9] rounded-full flex items-center justify-center mb-6">
                    <User className="w-12 h-12 text-[#A19D96] opacity-30" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#2D2A26]">Chọn một thành viên</h3>
                  <p className="text-sm text-[#A19D96] mt-2">Nhấp vào thẻ thành viên bên trái để xem thông tin chi tiết và tiểu sử.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberList;
