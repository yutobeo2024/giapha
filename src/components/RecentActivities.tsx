import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { avatarUrl } from "../lib/avatar";
import type { ActivityLog } from "../types";

const PAGE_SIZE = 5;

const pagerBtn =
  "inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-[#E5E1D8] bg-white text-xs font-bold text-[#6B665F] hover:text-[#8B2323] hover:border-[#8B2323]/30 disabled:opacity-40 disabled:hover:text-[#6B665F] disabled:hover:border-[#E5E1D8] transition-colors";

/**
 * Hoạt động gần đây, 5 mục mỗi trang. Trang 1 tự cập nhật; các trang sau đọc một lần theo con trỏ
 * (mỗi trang chỉ tốn 6 lượt đọc: 5 mục + 1 để biết còn trang sau không).
 */
const RecentActivities: React.FC<{ onError: (msg: string) => void }> = ({ onError }) => {
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  // cursors[i] = mục cuối của trang i, để trang i + 1 đọc tiếp từ đó
  const cursors = useRef<QueryDocumentSnapshot[]>([]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const col = collection(db, "activities");
    const apply = (snap: QuerySnapshot) => {
      const docs = snap.docs.slice(0, PAGE_SIZE);
      if (docs.length) cursors.current[page] = docs[docs.length - 1];
      setItems(docs.map((d) => ({ ...d.data(), id: d.id }) as ActivityLog));
      setHasMore(snap.docs.length > PAGE_SIZE);
      setLoading(false);
    };
    const fail = (err: unknown) => {
      onErrorRef.current(handleFirestoreError(err, OperationType.LIST, "activities"));
      setLoading(false);
    };

    setLoading(true);
    if (page === 0) return onSnapshot(query(col, orderBy("timestamp", "desc"), limit(PAGE_SIZE + 1)), apply, fail);

    let cancelled = false;
    getDocs(query(col, orderBy("timestamp", "desc"), startAfter(cursors.current[page - 1]), limit(PAGE_SIZE + 1)))
      .then((snap) => !cancelled && apply(snap))
      .catch((err) => !cancelled && fail(err));
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4" aria-busy={loading}>
        {items.length > 0 ? (
          items.map((activity, i) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white p-6 rounded-3xl border border-[#E5E1D8] flex items-start gap-4 group hover:border-[#8B2323]/30 transition-all"
            >
              <img
                src={activity.userPhoto || avatarUrl(activity.userName)}
                alt={activity.userName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl border border-[#E5E1D8] object-cover"
              />
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-[#2D2A26] group-hover:text-[#8B2323] transition-colors">{activity.userName}</span>
                  <span className="text-[10px] text-[#A19D96] font-medium shrink-0">
                    {format(new Date(activity.timestamp), "HH:mm, d MMM", { locale: vi })}
                  </span>
                </div>
                <p className="text-sm text-[#6B665F] break-words">{activity.action}</p>
              </div>
            </motion.div>
          ))
        ) : loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-3xl border border-[#E5E1D8] animate-pulse" />)
        ) : (
          <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-[#E5E1D8]">
            <Activity className="w-12 h-12 text-[#A19D96] opacity-20 mx-auto mb-4" />
            <p className="text-[#A19D96] text-sm font-medium">Chưa có hoạt động mới nào.</p>
          </div>
        )}
      </div>

      {(page > 0 || hasMore) && (
        <nav className="flex items-center justify-between gap-3" aria-label="Chuyển trang hoạt động">
          <button type="button" className={pagerBtn} disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" /> Mới hơn
          </button>
          <span className="text-xs font-bold text-[#A19D96]">Trang {page + 1}</span>
          <button type="button" className={pagerBtn} disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
            Cũ hơn <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default RecentActivities;
