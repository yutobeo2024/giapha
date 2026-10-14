import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, where, onSnapshot, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { motion } from "framer-motion";
import {
  Users,
  History,
  Calendar,
  Activity,
  ChevronRight,
  ArrowUpRight,
  Quote,
  ShieldCheck,
  HeartPulse,
  Search,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import type { ActivityLog, FamilyEvent, FamilyMember } from "../types";
import { avatarUrl } from "../lib/avatar";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<FamilyEvent[]>([]);
  const [founder, setFounder] = useState<FamilyMember | null>(null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalGenerations: 0,
    aliveMembers: 0,
  });
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Thống kê + Thủy tổ (đời 1, không có cha mẹ)
    const fetchStats = async () => {
      try {
        const membersSnap = await getDocs(collection(db, "members"));
        const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember));
        const generations = new Set(members.map(m => m.generation));
        setStats({
          totalMembers: members.length,
          totalGenerations: generations.size,
          aliveMembers: members.filter(m => m.status === "Alive").length,
        });
        const root = members
          .filter(m => !m.fatherId && !m.motherId)
          .sort((a, b) => a.generation - b.generation)[0];
        setFounder(root || null);
      } catch (err) {
        setError(handleFirestoreError(err, OperationType.LIST, "members"));
      }
    };

    const qActivities = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(4));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    }, (err) => setError(handleFirestoreError(err, OperationType.LIST, "activities")));

    // Chỉ lấy sự kiện từ hôm nay trở đi
    const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const qEvents = query(
      collection(db, "events"),
      where("date", ">=", todayIso),
      orderBy("date", "asc"),
      limit(3)
    );
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setUpcomingEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyEvent)));
    }, (err) => setError(handleFirestoreError(err, OperationType.LIST, "events")));

    fetchStats();
    return () => {
      unsubActivities();
      unsubEvents();
    };
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/members?q=${encodeURIComponent(q)}` : "/members");
  };

  return (
    <div className="space-y-10 pb-20">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">{error}</div>
      )}
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2D2A26]">Tổng Quan Gia Tộc</h1>
          <p className="text-[#A19D96] text-sm mt-1">Chào mừng bạn quay trở lại với không gian truyền thống dòng họ.</p>
        </div>
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm thành viên..."
              className="pl-10 pr-4 py-2 bg-white border border-[#E5E1D8] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20 w-64"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A19D96]" />
          </div>
        </form>
      </div>

      {/* Hero Banner */}
      <section className="relative rounded-[40px] overflow-hidden bg-[#FDFCF9] border border-[#E5E1D8] p-8 md:p-12">
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-[0.04] pointer-events-none bg-[#8B2323]" />

        <div className="relative z-10 max-w-3xl">
          <span className="inline-block px-4 py-1 bg-[#8B2323] text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full mb-6">
            Lịch Sử & Truyền Thống
          </span>
          <h2 className="font-serif text-5xl md:text-6xl font-black text-[#2D2A26] leading-[1.1] mb-6">
            Hành Trình Phát Triển <br />
            <span className="text-[#8B2323] italic">Chi Họ Nguyễn Nhuận</span>
          </h2>
          <div className="space-y-4 text-[#6B665F] text-lg leading-relaxed max-w-2xl italic font-serif">
            <p>
              "Cây có cội mới nảy cành xanh lá, nước có nguồn mới bể rộng sông sâu." Chi họ Nguyễn Nhuận trải qua quá trình hình thành và phát triển lâu đời, gắn liền với sự sinh sôi và thành đạt của các thế hệ hậu duệ.
            </p>
            <p className="text-base not-italic font-sans text-[#A19D96]">
              Dòng họ luôn chú trọng việc bảo tồn giá trị truyền thống, tôn tạo lăng mộ và nhà thờ tổ tiên trang nghiêm. Đây là nền tảng vững chắc để con cháu luôn nhớ về cội nguồn, nỗ lực học tập và rèn luyện bản thân để xứng đáng với công lao của các bậc tiền nhân.
            </p>
          </div>
          <Link
            to="/gioi-thieu"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-[#8B2323] text-white font-bold text-sm shadow-lg shadow-[#8B2323]/25 hover:bg-[#6B1B1B] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Xem hành trình dòng họ 3D
          </Link>
        </div>

        <div className="absolute bottom-12 right-12 hidden lg:block">
          <div className="bg-white p-6 rounded-3xl border border-[#E5E1D8] shadow-xl rotate-3">
             <div className="w-24 h-24 bg-[#8B2323] rounded-2xl flex items-center justify-center text-white font-serif text-4xl mb-4 mx-auto">
               阮
             </div>
             <div className="text-center">
               <div className="text-[10px] font-bold uppercase tracking-widest text-[#A19D96]">Dòng Tộc</div>
               <div className="font-serif font-bold text-[#2D2A26]">NGUYỄN NHUẬN</div>
             </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Tổng số đời", value: stats.totalGenerations, sub: "Thế hệ", icon: History, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Tổng thành viên", value: stats.totalMembers, sub: "Nhân khẩu", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Còn sống", value: stats.aliveMembers, sub: "Thành viên", icon: HeartPulse, color: "text-[#8B2323]", bg: "bg-red-50" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[32px] border border-[#E5E1D8] flex items-center gap-6 shadow-sm"
          >
            <div className={`w-16 h-16 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <div>
              <div className="text-3xl font-black text-[#2D2A26]">{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#A19D96] mt-1">
                {stat.label} <span className="text-[#6B665F] ml-1">/ {stat.sub}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Activities */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-[#8B2323] rounded-full" />
              <h3 className="font-serif text-2xl font-bold text-[#2D2A26]">Hoạt Động Gần Đây</h3>
            </div>
            <Link to="/members" className="text-xs font-bold text-[#8B2323] flex items-center gap-1 hover:underline">
              Xem thành viên <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid gap-4">
            {activities.length > 0 ? activities.map((activity, i) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-3xl border border-[#E5E1D8] flex items-start gap-4 group hover:border-[#8B2323]/30 transition-all"
              >
                <img 
                  src={activity.userPhoto || avatarUrl(activity.userName)}
                  alt={activity.userName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl border border-[#E5E1D8] object-cover"
                />
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#2D2A26] group-hover:text-[#8B2323] transition-colors">{activity.userName}</span>
                    <span className="text-[10px] text-[#A19D96] font-medium">
                      {format(new Date(activity.timestamp), "HH:mm, d MMM", { locale: vi })}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B665F]">{activity.action}</p>
                </div>
              </motion.div>
            )) : (
              <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-[#E5E1D8]">
                <Activity className="w-12 h-12 text-[#A19D96] opacity-20 mx-auto mb-4" />
                <p className="text-[#A19D96] text-sm font-medium">Chưa có hoạt động mới nào.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Events & Founder */}
        <div className="lg:col-span-4 space-y-10">
          {/* Upcoming Events */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-[#8B2323] rounded-full" />
              <h3 className="font-serif text-2xl font-bold text-[#2D2A26]">Sự Kiện Sắp Tới</h3>
            </div>
            
            <div className="space-y-4">
              {upcomingEvents.length === 0 && (
                <div className="bg-white p-5 rounded-3xl border border-dashed border-[#E5E1D8] text-sm text-[#A19D96] text-center">
                  Chưa có sự kiện sắp tới.
                </div>
              )}
              {upcomingEvents.map((event) => (
                <div key={event.id} className="bg-white p-5 rounded-3xl border border-[#E5E1D8] flex gap-4 items-center">
                  <div className="w-14 h-14 bg-[#8B2323] rounded-2xl flex flex-col items-center justify-center text-white">
                    <span className="text-[10px] font-bold uppercase">{format(new Date(event.date), "MMM", { locale: vi })}</span>
                    <span className="text-xl font-black">{format(new Date(event.date), "dd")}</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#8B2323] tracking-widest mb-1">{event.type}</div>
                    <h4 className="font-bold text-[#2D2A26] text-sm">{event.title}</h4>
                  </div>
                </div>
              ))}
              <Link to="/events" className="w-full py-4 bg-[#FDFCF9] border border-[#E5E1D8] rounded-2xl text-xs font-bold text-[#6B665F] flex items-center justify-center gap-2 hover:bg-white transition-colors">
                Xem lịch gia đình <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </section>

          {/* Founder Section */}
          <section className="bg-[#FDFCF9] rounded-[40px] border border-[#E5E1D8] p-8 relative overflow-hidden">
            <Quote className="absolute top-6 right-6 w-12 h-12 text-[#8B2323] opacity-5" />
            <div className="text-center space-y-6">
              <h4 className="font-serif text-xl font-bold text-[#2D2A26]">Tổ Tiên Khởi Đầu</h4>
              <div className="relative inline-block">
                {founder?.photoUrl ? (
                  <img
                    src={founder.photoUrl}
                    alt={founder.name}
                    className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl bg-[#8B2323] text-white font-serif text-6xl flex items-center justify-center">
                    阮
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 bg-[#8B2323] text-white p-2 rounded-xl shadow-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h5 className="font-serif text-2xl font-bold text-[#8B2323]">
                  {founder ? `Thủy Tổ ${founder.name}` : "Thủy Tổ"}
                </h5>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A19D96] mt-1">
                  {founder ? `Thế hệ thứ ${founder.generation}` : "Thế Hệ Thứ Nhất"}
                </p>
              </div>
              <p className="text-sm text-[#6B665F] leading-relaxed italic">
                "Thế hệ trẻ hãy luôn nhớ về cội nguồn, trân trọng và tôn kính tổ tiên. Sự đoàn kết, yêu thương và tinh thần tương trợ lẫn nhau là nền tảng vững chắc để vươn lên, xây dựng cộng đồng ngày càng vững mạnh."
              </p>
              <Link 
                to="/biography" 
                className="text-xs font-bold text-[#2D2A26] border-b-2 border-[#8B2323] pb-1 hover:text-[#8B2323] transition-colors inline-block"
              >
                Đọc thêm tiểu sử
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
