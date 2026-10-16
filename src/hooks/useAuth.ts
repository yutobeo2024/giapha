import { useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { isSuperAdminEmail } from "../config";
import type { UserRole } from "../types";

export interface AuthState {
  user: User | null;
  role: UserRole;
  /** editor hoặc admin: được thêm/sửa thành viên, sự kiện */
  isEditor: boolean;
  /** admin: thêm quyền duyệt/khóa người dùng */
  isAdmin: boolean;
  /** chỉ super admin (email cố định) mới nâng/hạ admin */
  isSuperAdmin: boolean;
  /** vừa bị từ chối đăng nhập vì tài khoản khóa */
  lockedNotice: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  dismissLockedNotice: () => void;
}

/**
 * Nguồn sự thật duy nhất về đăng nhập + vai trò.
 * - Lần đầu đăng nhập: tạo users/{uid} với role "user" (chờ duyệt). Super admin được "admin".
 * - Theo dõi users/{uid} bằng onSnapshot: admin duyệt xong, người dùng thấy quyền mới ngay.
 * - Tài khoản isLocked: đăng xuất ngay và hiện thông báo.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("user");
  const [loading, setLoading] = useState(true);
  const [lockedNotice, setLockedNotice] = useState(false);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (!currentUser) {
        setUser(null);
        setRole("user");
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", currentUser.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const defaultRole: UserRole = currentUser.emailVerified && isSuperAdminEmail(currentUser.email) ? "admin" : "user";
          await setDoc(userRef, {
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            role: defaultRole,
            isLocked: false,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          });
        } else {
          if (snap.data().isLocked) {
            setLockedNotice(true);
            await signOut(auth);
            return;
          }
          await setDoc(
            userRef,
            {
              lastLogin: serverTimestamp(),
              photoURL: currentUser.photoURL,
              displayName: currentUser.displayName,
            },
            { merge: true }
          );
        }
      } catch (error) {
        console.error("Không đọc/ghi được hồ sơ người dùng:", error);
      }

      unsubUserDoc = onSnapshot(userRef, (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.isLocked) {
          setLockedNotice(true);
          signOut(auth);
          return;
        }
        setRole((data.role as UserRole) || "user");
      });

      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const login = useCallback(async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Đăng nhập thất bại:", error);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Đăng xuất thất bại:", error);
    }
  }, []);

  // Giống firestore.rules: email super admin phải đã xác minh
  const isSuperAdmin = !!user?.emailVerified && isSuperAdminEmail(user.email);
  const isAdmin = !!user && (role === "admin" || isSuperAdmin);
  const isEditor = !!user && (role === "editor" || isAdmin);

  return {
    user,
    role: isSuperAdmin ? "admin" : role,
    isEditor,
    isAdmin,
    isSuperAdmin,
    lockedNotice,
    loading,
    login,
    logout,
    dismissLockedNotice: () => setLockedNotice(false),
  };
}
