import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { motion } from "framer-motion";
import { History, Activity, ChevronRight, Users, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface ActivityLog {
  id: string;
  userName: string;
  userPhoto?: string;
  action: string;
  timestamp: string;
  details?: string;
}

const Home: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      setActivities(logs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "activities");
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative h-[400px] rounded-3xl overflow-hidden bg-[#8B2323] text-white flex items-center justify-center p-8 text-center">
        <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/seed/family/1920/1080')] bg-cover bg-center" />
        <div className="relative z-10 max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-5xl md:text-6xl font-bold mb-6 tracking-tight"
          >
            Gia Phả Họ Nguyễn Nhuận
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-white/80 font-medium leading-relaxed"
          >
            Lưu giữ và tôn vinh cội nguồn, gắn kết các thế hệ dòng họ Nguyễn Nhuận.
          </motion.p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* History Section */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-3xl p-8 border border-[#E5E1D8] shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#FDFCF9] rounded-xl border border-[#E5E1D8]">
                <History className="w-6 h-6 text-[#8B2323]" />
              </div>
              <h2 className="font-serif text-2xl font-bold">Lịch sử Dòng họ</h2>
            </div>
            <div className="prose prose-stone max-w-none text-[#6B665F] leading-relaxed space-y-4">
              <p>
                Dòng họ Nguyễn Nhuận có nguồn gốc từ vùng đất địa linh nhân kiệt, trải qua nhiều thế hệ với những truyền thống tốt đẹp về hiếu học, cần cù và yêu nước.
              </p>
              <p>
                Thủy tổ của dòng họ là cụ Nguyễn Nhuận, người đã đặt nền móng đầu tiên cho sự phát triển của gia tộc. Từ những ngày đầu khai hoang lập ấp, con cháu họ Nguyễn Nhuận đã không ngừng nỗ lực, đóng góp công sức vào sự nghiệp xây dựng và bảo vệ quê hương.
              </p>
              <p>
                Ngày nay, con cháu họ Nguyễn Nhuận đã tỏa đi khắp mọi miền đất nước và cả hải ngoại, nhưng vẫn luôn hướng về cội nguồn, gìn giữ nếp nhà và các giá trị văn hóa truyền thống của tổ tiên để lại.
              </p>
            </div>
          </section>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Thành viên", value: "120+", icon: Users, color: "bg-blue-50 text-blue-600" },
              { label: "Thế hệ", value: "8", icon: History, color: "bg-amber-50 text-amber-600" },
              { label: "Sự kiện năm", value: "12", icon: Calendar, color: "bg-emerald-50 text-emerald-600" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-2xl border border-[#E5E1D8] flex items-center gap-4 shadow-sm"
              >
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-[#A19D96] uppercase tracking-widest font-bold">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="space-y-8">
          <section className="bg-white rounded-3xl p-8 border border-[#E5E1D8] shadow-sm h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#FDFCF9] rounded-xl border border-[#E5E1D8]">
                <Activity className="w-6 h-6 text-[#8B2323]" />
              </div>
              <h2 className="font-serif text-2xl font-bold">Hoạt động mới</h2>
            </div>
            
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex gap-4 items-start">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="flex-grow space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-6">
                {activities.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 items-start group"
                  >
                    <img
                      src={log.userPhoto || `https://ui-avatars.com/api/?name=${log.userName}`}
                      alt={log.userName}
                      className="w-10 h-10 rounded-full border border-[#E5E1D8] flex-shrink-0"
                    />
                    <div className="flex-grow">
                      <p className="text-sm">
                        <span className="font-bold text-[#2D2A26]">{log.userName}</span>
                        {" "}
                        <span className="text-[#6B665F]">{log.action}</span>
                      </p>
                      <p className="text-xs text-[#A19D96] mt-1">
                        {format(new Date(log.timestamp), "HH:mm, d MMMM yyyy", { locale: vi })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-[#A19D96]">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Chưa có hoạt động nào mới.</p>
              </div>
            )}

            <button className="w-full mt-8 py-3 px-4 bg-[#FDFCF9] border border-[#E5E1D8] text-[#6B665F] rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              Xem tất cả hoạt động
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Home;
