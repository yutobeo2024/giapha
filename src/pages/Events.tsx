import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, MapPin, Clock, Info, ChevronRight, X } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

interface FamilyEvent {
  id: string;
  title: string;
  date: string;
  location?: string;
  description?: string;
  type: "Kỵ nhật" | "Hội họp" | "Khác";
  memberId?: string;
}

const Events: React.FC = () => {
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<FamilyEvent | null>(null);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyEvent));
      setEvents(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "events");
    });
    return () => unsubscribe();
  }, []);

  const eventsOnSelectedDate = events.filter(e => isSameDay(parseISO(e.date), selectedDate));

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const hasEvent = events.some(e => isSameDay(parseISO(e.date), date));
      if (hasEvent) {
        return <div className="w-1 h-1 bg-[#8B2323] rounded-full mx-auto mt-1" />;
      }
    }
    return null;
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">Sự kiện Gia đình</h1>
          <p className="text-[#6B665F]">Lịch Kỵ nhật, hội họp và các hoạt động chung của dòng họ.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Calendar Section */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-[#E5E1D8] shadow-sm">
            <Calendar
              onChange={(value) => setSelectedDate(value as Date)}
              value={selectedDate}
              tileContent={tileContent}
              locale="vi-VN"
              className="w-full border-none font-sans"
            />
          </div>

          <div className="bg-[#8B2323] p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CalendarIcon className="w-8 h-8 mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">Ngày {format(selectedDate, "d MMMM", { locale: vi })}</h3>
            <p className="text-white/80 text-sm">
              {eventsOnSelectedDate.length > 0 
                ? `Có ${eventsOnSelectedDate.length} sự kiện diễn ra trong ngày này.`
                : "Không có sự kiện nào được ghi nhận."}
            </p>
          </div>
        </div>

        {/* Events List Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl font-bold">Danh sách Sự kiện</h2>
            <div className="text-sm text-[#A19D96] font-medium">
              {format(selectedDate, "EEEE, d MMMM yyyy", { locale: vi })}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white p-6 rounded-2xl border border-[#E5E1D8] h-24" />
              ))}
            </div>
          ) : eventsOnSelectedDate.length > 0 ? (
            <div className="space-y-4">
              {eventsOnSelectedDate.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => setSelectedEvent(event)}
                  className="bg-white p-6 rounded-2xl border border-[#E5E1D8] shadow-sm hover:border-[#8B2323]/30 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-[#FDFCF9] rounded-2xl border border-[#E5E1D8] flex flex-col items-center justify-center text-[#8B2323]">
                      <span className="text-xs font-bold uppercase">{format(parseISO(event.date), "MMM", { locale: vi })}</span>
                      <span className="text-2xl font-serif font-bold">{format(parseISO(event.date), "d")}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-[#FDFCF9] border border-[#E5E1D8] rounded text-[10px] font-bold uppercase text-[#8B2323]">
                          {event.type}
                        </span>
                        <h4 className="font-bold text-[#2D2A26] group-hover:text-[#8B2323] transition-colors">{event.title}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#A19D96]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(event.date), "HH:mm")}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#A19D96] group-hover:translate-x-1 transition-transform" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-[#E5E1D8] border-dashed">
              <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-[#A19D96] opacity-20" />
              <p className="text-[#A19D96]">Không có sự kiện nào vào ngày này.</p>
            </div>
          )}

          {/* Upcoming Events */}
          <div className="pt-8">
            <h3 className="font-serif text-xl font-bold mb-6">Sự kiện sắp tới</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {events
                .filter(e => parseISO(e.date) > new Date())
                .slice(0, 4)
                .map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-6 bg-white rounded-2xl border border-[#E5E1D8] shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-xs text-[#A19D96] font-bold uppercase mb-2">
                        {format(parseISO(event.date), "d MMMM yyyy", { locale: vi })}
                      </div>
                      <h4 className="font-bold text-[#2D2A26] mb-4">{event.title}</h4>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDate(parseISO(event.date));
                        setSelectedEvent(event);
                      }}
                      className="text-sm font-bold text-[#8B2323] flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Chi tiết <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEvent(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] bg-white rounded-3xl shadow-2xl z-[70] overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="px-3 py-1 bg-[#8B2323] text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {selectedEvent.type}
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="text-[#A19D96] hover:text-[#2D2A26]">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <h2 className="text-3xl font-serif font-bold text-[#2D2A26] mb-6">{selectedEvent.title}</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-[#FDFCF9] rounded-2xl border border-[#E5E1D8]">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#8B2323] shadow-sm">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-[#A19D96] uppercase font-bold">Thời gian</div>
                      <div className="font-medium">{format(parseISO(selectedEvent.date), "HH:mm, d MMMM yyyy", { locale: vi })}</div>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-center gap-4 p-4 bg-[#FDFCF9] rounded-2xl border border-[#E5E1D8]">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#8B2323] shadow-sm">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#A19D96] uppercase font-bold">Địa điểm</div>
                        <div className="font-medium">{selectedEvent.location}</div>
                      </div>
                    </div>
                  )}

                  {selectedEvent.description && (
                    <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-[#E5E1D8]">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#8B2323] mb-2">
                        <Info className="w-4 h-4" />
                        Mô tả chi tiết
                      </div>
                      <p className="text-[#6B665F] text-sm leading-relaxed">
                        {selectedEvent.description}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-[#E5E1D8]">
                  <button className="w-full py-4 bg-[#8B2323] text-white rounded-2xl font-bold hover:bg-[#6B1B1B] transition-colors shadow-lg shadow-[#8B2323]/20">
                    Thêm vào lịch cá nhân
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Events;
