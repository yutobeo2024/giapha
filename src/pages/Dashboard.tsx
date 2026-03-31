import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";
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
  ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Link } from "react-router-dom";

interface ActivityLog {
  id: string;
  userName: string;
  userPhoto?: string;
  action: string;
  timestamp: string;
}

interface FamilyEvent {
  id: string;
  title: string;
  date: string;
  type: string;
}

const Dashboard: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<FamilyEvent[]>([]);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalGenerations: 0,
    activeBranches: 6
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch Stats
    const fetchStats = async () => {
      try {
        const membersSnap = await getDocs(collection(db, "members"));
        const members = membersSnap.docs.map(doc => doc.data());
        const generations = new Set(members.map(m => m.generation));
        
        setStats({
          totalMembers: membersSnap.size,
          totalGenerations: generations.size || 0,
          activeBranches: 6 // Mocked or derived if branch field exists
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    // Fetch Activities
    const qActivities = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(4));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "activities"));

    // Fetch Events
    const qEvents = query(collection(db, "events"), orderBy("date", "asc"), limit(3));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setUpcomingEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyEvent)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "events"));

    fetchStats();
    return () => {
      unsubActivities();
      unsubEvents();
    };
  }, []);

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2D2A26]">Tổng Quan Gia Tộc</h1>
          <p className="text-[#A19D96] text-sm mt-1">Chào mừng bạn quay trở lại với không gian truyền thống dòng họ.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Tìm kiếm thành viên..." 
              className="pl-10 pr-4 py-2 bg-white border border-[#E5E1D8] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20 w-64"
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A19D96]" />
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <section className="relative rounded-[40px] overflow-hidden bg-[#FDFCF9] border border-[#E5E1D8] p-8 md:p-12">
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <img src="https://picsum.photos/seed/pattern/800/800" alt="pattern" className="object-cover w-full h-full grayscale" />
        </div>
        
        <div className="relative z-10 max-w-3xl">
          <span className="inline-block px-4 py-1 bg-[#8B2323] text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full mb-6">
            Khai Sáng Tổ Tiên
          </span>
          <h2 className="font-serif text-5xl md:text-6xl font-black text-[#2D2A26] leading-[1.1] mb-6">
            Gia Phả Họ Nguyễn Nhuận <br />
            <span className="text-[#8B2323] italic">Hưng Long - Thái Bình</span>
          </h2>
          <p className="text-[#6B665F] text-lg leading-relaxed max-w-xl italic font-serif">
            "Cây có cội mới nảy cành xanh lá, nước có nguồn mới bể rộng sông sâu." Nơi lưu giữ tâm hồn, huyết thống và những giá trị văn hóa truyền đời của dòng tộc Nguyễn Nhuận.
          </p>
        </div>

        <div className="absolute bottom-12 right-12 hidden lg:block">
          <div className="bg-white p-6 rounded-3xl border border-[#E5E1D8] shadow-xl rotate-3">
             <div className="w-24 h-24 bg-[#8B2323] rounded-2xl flex items-center justify-center text-white font-serif text-4xl mb-4 mx-auto">
               阮
             </div>
             <div className="text-center">
               <div className="text-[10px] font-bold uppercase tracking-widest text-[#A19D96]">Dòng Tộc</div>
               <div className="font-serif font-bold text-[#2D2A26]">TRIỆU VÀNG</div>
             </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Tổng số đời", value: stats.totalGenerations, sub: "Thế hệ", icon: History, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Tổng thành viên", value: stats.totalMembers, sub: "Nhân khẩu", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Chi nhánh hoạt động", value: stats.activeBranches, sub: "Chi tộc", icon: ShieldCheck, color: "text-[#8B2323]", bg: "bg-red-50" },
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
            <Link to="/admin" className="text-xs font-bold text-[#8B2323] flex items-center gap-1 hover:underline">
              Xem tất cả <ArrowUpRight className="w-3 h-3" />
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
                  src={activity.userPhoto || `https://ui-avatars.com/api/?name=${activity.userName}`} 
                  alt={activity.userName} 
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
                <img 
                  src="https://picsum.photos/seed/ancestor/200/200" 
                  alt="Founder" 
                  className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl object-cover grayscale"
                />
                <div className="absolute -bottom-2 -right-2 bg-[#8B2323] text-white p-2 rounded-xl shadow-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h5 className="font-serif text-2xl font-bold text-[#8B2323]">Thủy Tổ Nguyễn Nhuận Công</h5>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A19D96] mt-1">Thế Hệ Thứ Nhất</p>
              </div>
              <p className="text-sm text-[#6B665F] leading-relaxed italic">
                "Người có công khai khẩn đất hoang, lập nên cơ đồ cho con cháu muôn đời sau. Đức độ sáng ngời như vầng nhật nguyệt."
              </p>
              <button className="text-xs font-bold text-[#2D2A26] border-b-2 border-[#8B2323] pb-1 hover:text-[#8B2323] transition-colors">
                Đọc thêm tiểu sử
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
