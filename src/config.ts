/**
 * Hằng số cấu hình dùng chung.
 * LƯU Ý: SUPER_ADMIN_EMAIL cũng được lặp lại trong firestore.rules (rules không import được).
 * Khi đổi email ở đây phải đổi cả trong firestore.rules và biến môi trường SUPER_ADMIN_EMAIL trên Cloudflare Pages.
 */
export const SUPER_ADMIN_EMAIL = "hanhtoami@gmail.com";

export const isSuperAdminEmail = (email: string | null | undefined) =>
  !!email && email.toLowerCase().trim() === SUPER_ADMIN_EMAIL;

/**
 * Domain chính thức của site. Firebase Auth luôn dùng domain này làm authDomain
 * (qua proxy /__/auth của Cloudflare Pages) dù người dùng vào bằng www, pages.dev
 * hay địa chỉ xem trước, để redirect_uri luôn khớp với OAuth client đã khai báo.
 */
export const CANONICAL_AUTH_DOMAIN = "giaphanguyennhuan.com";
