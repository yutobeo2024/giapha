import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { CANONICAL_AUTH_DOMAIN } from './config';

/**
 * Trên môi trường thật, luôn dùng CANONICAL_AUTH_DOMAIN làm authDomain
 * (Pages Function functions/__/auth/[[path]].ts proxy sang firebaseapp.com).
 * Dùng một domain cố định thay vì window.location.hostname để www.*, *.pages.dev
 * và địa chỉ xem trước không bị lỗi redirect_uri_mismatch.
 * Khi chạy localhost (vite dev) vẫn dùng authDomain gốc của Firebase.
 */
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const app = initializeApp({
  ...firebaseConfig,
  authDomain: isLocalhost ? firebaseConfig.authDomain : CANONICAL_AUTH_DOMAIN,
});

export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    localCache: memoryLocalCache(),
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const OPERATION_LABEL: Record<OperationType, string> = {
  create: 'tạo mới',
  update: 'cập nhật',
  delete: 'xóa',
  list: 'tải danh sách',
  get: 'đọc',
  write: 'ghi',
};

/**
 * Ghi log lỗi Firestore kèm ngữ cảnh và trả về thông báo tiếng Việt để hiển thị.
 * KHÔNG throw: caller tự quyết định hiển thị thế nào.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code ?? '';

  console.error('Firestore error', {
    operationType,
    path,
    code,
    message: raw,
    userId: auth.currentUser?.uid ?? null,
    email: auth.currentUser?.email ?? null,
  });

  if (code === 'permission-denied' || raw.includes('Missing or insufficient permissions')) {
    return `Bạn không có quyền ${OPERATION_LABEL[operationType]} dữ liệu này.`;
  }
  if (code === 'unavailable' || raw.includes('client is offline')) {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  }
  if (code === 'failed-precondition' && raw.includes('index')) {
    return 'Thiếu chỉ mục Firestore. Quản trị viên cần chạy "firebase deploy --only firestore".';
  }
  return `Đã xảy ra lỗi khi ${OPERATION_LABEL[operationType]} dữ liệu.`;
}
