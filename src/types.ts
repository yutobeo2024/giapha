import type { LunarDate } from "./lib/lunar";

export type Gender = "Nam" | "Nữ";
export type MemberStatus = "Alive" | "Deceased";
export type UserRole = "user" | "editor" | "admin";
export type EventType = "Kỵ nhật" | "Hội họp" | "Khác";

export interface FamilyMember {
  id: string;
  name: string;
  gender: Gender;
  generation: number;
  birthDate?: string;
  deathDate?: string;
  branch?: string;
  role?: string;
  biography?: string;
  fatherId?: string;
  motherId?: string;
  /** Tên vợ/chồng (chuỗi tự do) */
  spouse?: string;
  address?: string;
  photoUrl?: string;
  status?: MemberStatus;
}

export type MemberInput = Omit<FamilyMember, "id">;

export interface FamilyEvent {
  id: string;
  title: string;
  /** ISO date-time string: lần diễn ra đầu tiên (sự kiện âm lịch thì là ngày dương đã quy đổi) */
  date: string;
  /** Lịch admin dùng khi nhập; thiếu = "solar" (sự kiện cũ) */
  calendar?: "lunar" | "solar";
  /** Ngày âm lịch admin nhập, chỉ có khi calendar = "lunar" */
  lunar?: LunarDate;
  /** Lặp lại hằng năm (theo lịch đã chọn) */
  recurring?: boolean;
  location?: string;
  description?: string;
  type: EventType;
  memberId?: string;
}

export interface ActivityLog {
  id: string;
  userName: string;
  userPhoto?: string;
  action: string;
  /** ISO date-time string */
  timestamp: string;
  details?: string;
}

export interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isLocked: boolean;
  createdAt?: { toDate: () => Date } | null;
  lastLogin?: { toDate: () => Date } | null;
}

/** Thiếu trạng thái thì coi như đã mất (dữ liệu cũ phần lớn là tiền nhân) */
export const isAlive = (m: Pick<FamilyMember, "status">): boolean => m.status === "Alive";

export const STATUS_LABEL: Record<MemberStatus, string> = {
  Alive: "Còn sống",
  Deceased: "Đã mất",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  user: "Chờ duyệt",
  editor: "Biên tập",
  admin: "Quản trị",
};

/** Bài trên trang Thông tin: tự soạn (article) hoặc thẻ liên kết tới bài báo gốc (link). */
export type PostKind = "article" | "link";

export interface PostSource {
  name: string;
  url: string;
}

export interface Post {
  /** document id, đồng thời là đường dẫn /thong-tin/<id> */
  id: string;
  kind: PostKind;
  title: string;
  summary?: string;
  /** Nội dung dạng markdown rút gọn (xem src/lib/markdown.tsx) */
  content?: string;
  coverUrl?: string;
  coverCaption?: string;
  /** Nguồn tham khảo / bài gốc; với kind "link" phần tử đầu là bài được nhúng */
  sources?: PostSource[];
  /** Ngày sự kiện hoặc ngày đăng gốc, YYYY-MM-DD */
  eventDate?: string;
  published: boolean;
  pinned?: boolean;
  authorName?: string;
  /** ISO date-time string */
  createdAt: string;
  updatedAt: string;
}

export type PostInput = Omit<Post, "id">;
