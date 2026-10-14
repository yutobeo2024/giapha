import { Auth, type KeyStorer } from "firebase-auth-cloudflare-workers";
import type { Env } from "./env";

/**
 * Cache public key của Google trong bộ nhớ isolate (đủ cho gói Free, không cần KV).
 * Worker isolate sống vài phút đến vài giờ; hết thì tải lại key, không ảnh hưởng đúng/sai.
 */
class MemoryKeyStore implements KeyStorer {
  private value: string | null = null;
  private expiresAt = 0;

  async get<T = unknown>(): Promise<T | null> {
    if (!this.value || Date.now() > this.expiresAt) return null;
    return JSON.parse(this.value) as T;
  }

  async put(value: string, expirationTtl: number): Promise<void> {
    this.value = value;
    this.expiresAt = Date.now() + expirationTtl * 1000;
  }
}

const keyStore = new MemoryKeyStore();

export type Role = "user" | "editor" | "admin";

export interface Caller {
  uid: string;
  email: string | null;
  role: Role;
  isLocked: boolean;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Xác minh Firebase ID token từ header Authorization, rồi đọc role trong users/{uid}. */
export async function authenticate(request: Request, env: Env): Promise<Caller> {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new AuthError(401, "Thiếu token đăng nhập.");
  const idToken = match[1];

  let uid: string;
  let email: string | null;
  try {
    const auth = Auth.getOrInitialize(env.FIREBASE_PROJECT_ID, keyStore);
    const decoded = await auth.verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch (e) {
    console.warn("verifyIdToken failed:", e instanceof Error ? e.message : e);
    throw new AuthError(401, "Token không hợp lệ hoặc đã hết hạn.");
  }

  const isSuperAdmin = !!email && email.toLowerCase() === env.SUPER_ADMIN_EMAIL.toLowerCase();

  // Đọc users/{uid} bằng chính token của người dùng (rules cho phép chính chủ đọc).
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/${env.FIRESTORE_DATABASE_ID}/documents/users/${uid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });

  if (res.status === 404) {
    if (isSuperAdmin) return { uid, email, role: "admin", isLocked: false };
    throw new AuthError(403, "Chưa có hồ sơ người dùng.");
  }
  if (!res.ok) {
    console.warn("Firestore REST error", res.status, await res.text().catch(() => ""));
    throw new AuthError(502, "Không đọc được hồ sơ người dùng.");
  }

  const doc = (await res.json()) as {
    fields?: { role?: { stringValue?: string }; isLocked?: { booleanValue?: boolean } };
  };
  const role = (doc.fields?.role?.stringValue as Role) || "user";
  const isLocked = doc.fields?.isLocked?.booleanValue === true;

  return { uid, email, role: isSuperAdmin ? "admin" : role, isLocked: isSuperAdmin ? false : isLocked };
}

export function requireEditor(caller: Caller): void {
  if (caller.isLocked) throw new AuthError(403, "Tài khoản đã bị khóa.");
  if (caller.role !== "editor" && caller.role !== "admin") {
    throw new AuthError(403, "Tài khoản chưa được duyệt quyền chỉnh sửa.");
  }
}

export function requireAdmin(caller: Caller): void {
  if (caller.isLocked) throw new AuthError(403, "Tài khoản đã bị khóa.");
  if (caller.role !== "admin") throw new AuthError(403, "Chỉ quản trị viên được thực hiện.");
}
