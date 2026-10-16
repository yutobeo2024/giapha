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
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as FamilyMember).sort(byGenThenName);
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

/** Biên tập viên vừa thêm/sửa/xóa một người: sửa ngay danh sách đang giữ trong phiên, không chờ máy chủ. */
export function patchMembersCache(id: string, member: FamilyMember | null): void {
  if (!cache) return;
  const rest = cache.filter((m) => m.id !== id);
  cache = (member ? [...rest, member] : rest).sort(byGenThenName);
  listeners.forEach((fn) => fn(cache!));
}

/**
 * Đẩy thay đổi lên bản chụp công khai trên máy chủ rồi tải lại.
 * Có `id`: máy chủ chỉ đọc lại đúng thành viên đó (1 lượt đọc Firestore); không có: dựng lại toàn bộ.
 * Trả về false nếu máy chủ không cập nhật được (danh sách trong phiên vẫn giữ bản đã sửa tại chỗ).
 */
export async function refreshMembersSnapshot(user: User | null, id?: string): Promise<boolean> {
  // `npm run dev` không có Pages Functions: danh sách đọc thẳng Firestore nên không có gì để làm mới
  if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return true;
  if (!user) return false;
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/members/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...(id ? { "Content-Type": "application/json" } : {}) },
      body: id ? JSON.stringify({ id }) : undefined,
    });
    if (!res.ok) {
      console.warn("Không làm mới được bản chụp thành viên:", res.status, await res.text().catch(() => ""));
      return false;
    }
  } catch (e) {
    console.warn("Không làm mới được bản chụp thành viên:", e);
    return false;
  }
  // Sửa một người: danh sách trong phiên đã sửa tại chỗ (patchMembersCache), không cần tải lại cả danh sách
  if (!id) await fetchMembers(true).catch(() => undefined);
  return true;
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
