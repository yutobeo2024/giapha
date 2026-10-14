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
  /** ISO date-time string */
  date: string;
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

export const STATUS_LABEL: Record<MemberStatus, string> = {
  Alive: "Còn sống",
  Deceased: "Đã mất",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  user: "Chờ duyệt",
  editor: "Biên tập",
  admin: "Quản trị",
};
