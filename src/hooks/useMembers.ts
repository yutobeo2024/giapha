import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import type { FamilyMember } from "../types";

/**
 * Danh sách thành viên cho các trang công khai (Tổng quan, Cây gia phả, Danh sách, Giới thiệu).
 * Lấy từ /api/members (bản chụp lưu ở Cloudflare R2) thay vì đọc cả collection Firestore mỗi lần mở trang:
 * gói Spark của Firebase chỉ có 50.000 lượt đọc mỗi ngày, mỗi thành viên tính một lượt.
 * Kết quả giữ trong bộ nhớ suốt phiên, chuyển trang không tải lại.
 * Khi chạy `npm run dev` (không có Pages Functions) thì tự đọc thẳng Firestore.
 */

const byGenThenName = (a: FamilyMember, b: FamilyMember) => a.generation - b.generation || a.name.localeCompare(b.name, "vi");

let cache: FamilyMember[] | null = null;
let inflight: Promise<FamilyMember[]> | null = null;
const listeners = new Set<(m: FamilyMember[]) => void>();

async function load(fresh: boolean): Promise<FamilyMember[]> {
  try {
    const res = await fetch(fresh ? `/api/members?t=${Date.now()}` : "/api/members", fresh ? { cache: "no-store" } : undefined);
    if (!res.ok || !(res.headers.get("Content-Type") || "").includes("json")) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { members: FamilyMember[] };
    return data.members.sort(byGenThenName);
  } catch (e) {
    console.warn("Không lấy được /api/members, đọc thẳng Firestore:", e);
    const snap = await getDocs(collection(db, "members"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember).sort(byGenThenName);
  }
}

export function fetchMembers(fresh = false): Promise<FamilyMember[]> {
  if (cache && !fresh) return Promise.resolve(cache);
  if (inflight && !fresh) return inflight;
  inflight = load(fresh)
    .then((m) => {
      cache = m;
      listeners.forEach((fn) => fn(m));
      return m;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Biên tập viên vừa thêm/sửa/xóa thành viên: dựng lại bản chụp trên máy chủ rồi tải lại. */
export async function refreshMembersSnapshot(user: User | null): Promise<void> {
  try {
    if (user) {
      const token = await user.getIdToken();
      await fetch("/api/members/refresh", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    }
  } catch (e) {
    console.warn("Không làm mới được bản chụp thành viên:", e);
  }
  cache = null;
  await fetchMembers(true).catch(() => undefined);
}

export function useMembers() {
  const [members, setMembers] = useState<FamilyMember[]>(() => cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const onUpdate = (m: FamilyMember[]) => alive && setMembers(m);
    listeners.add(onUpdate);
    fetchMembers()
      .then((m) => {
        if (!alive) return;
        setMembers(m);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setError("Không tải được danh sách thành viên. Vui lòng thử lại sau.");
        setLoading(false);
      });
    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  return { members, loading, error };
}
