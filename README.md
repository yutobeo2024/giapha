# Gia Phả Họ Nguyễn Nhuận

Ứng dụng web quản lý gia phả: danh sách thành viên theo đời, sơ đồ cây (xuất PDF A3), lịch sự kiện (kỵ nhật, hội họp), tiểu sử dòng họ, và trang quản trị.

**Stack:** React 19 · Vite · Tailwind 4 · Firebase (Google Auth + Firestore) · Cloudflare Pages + Functions + R2 (ảnh).

## Vai trò người dùng

| Vai trò | Cách có | Quyền |
|---|---|---|
| Khách | không cần đăng nhập | xem toàn bộ gia phả |
| `user` | đăng nhập Google lần đầu | như khách, chờ duyệt |
| `editor` | admin duyệt trong tab **Người dùng** | thêm/sửa thành viên, sự kiện, tải ảnh |
| `admin` | super admin nâng cấp | tất cả + duyệt/khóa người dùng, xóa dữ liệu, nạp dữ liệu gốc |

Super admin là email cố định, khai báo ở **3 nơi phải giống nhau**: `src/config.ts`, `firestore.rules`, và biến `SUPER_ADMIN_EMAIL` (trong `wrangler.toml` hoặc Dashboard Cloudflare).

## Chạy local

```bash
npm install
npm run dev          # http://localhost:5173 (chỉ front-end, không có upload ảnh)
npm run lint         # tsc --noEmit
npm run build        # ra thư mục dist/
npm run preview      # wrangler pages dev dist → http://localhost:8788, có Functions + R2 giả lập
```

Khi chạy `npm run preview`, Firebase Auth dùng `localhost` nên vẫn đăng nhập được; ảnh upload lưu vào R2 giả lập trong `.wrangler/`.

## Cấu trúc

```
src/
  config.ts            SUPER_ADMIN_EMAIL
  types.ts             FamilyMember, FamilyEvent, UserDoc, UserRole...
  firebase.ts          khởi tạo Firebase, handleFirestoreError (trả thông báo, không throw)
  hooks/useAuth.ts     đăng nhập, tạo users/{uid}, theo dõi role realtime, khóa tài khoản
  hooks/AuthContext.tsx
  lib/image.ts         resize ảnh 800px + upload /api/photos
  lib/ics.ts           xuất sự kiện ra .ics
  data/seedMembers.ts  92 thành viên 22 đời (nút "Nạp dữ liệu gốc")
  pages/               Dashboard, MemberList, FamilyTree, Events, Biography, Admin
functions/             Cloudflare Pages Functions
  api/photos/index.ts  POST upload ảnh (xác thực Firebase token + role editor/admin)
  api/photos/[key].ts  GET ảnh từ R2, cache 1 năm
  __/auth/[[path]].ts  proxy Firebase Auth về domain của mình
firestore.rules        phân quyền Firestore
firestore.indexes.json chỉ mục composite (members: generation + name)
wrangler.toml          cấu hình Pages, biến môi trường, binding R2
```

## Deploy lần đầu (gói Cloudflare Free)

### 1. Đưa domain về Cloudflare
1. Đăng ký tài khoản tại dash.cloudflare.com → **Add a site** → nhập domain → chọn gói **Free**.
2. Cloudflare đưa ra 2 nameserver. Vào nhà cung cấp domain hiện tại, đổi nameserver sang 2 giá trị đó.
3. Chờ Cloudflare báo **Active** (5 phút đến 24 giờ).

### 2. Tạo bucket R2
Dashboard → **R2 Object Storage** → **Create bucket** → tên `giapha-photos` (phải trùng `wrangler.toml`). Lần đầu bật R2 có thể yêu cầu thêm thẻ nhưng không tính phí trong hạn mức 10GB.

### 3. Tạo project Pages từ GitHub
1. Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → chọn repo này.
2. Build settings: Framework preset **None**, Build command `npm run build`, Build output directory `dist`.
3. **Save and Deploy**. Lần build đầu sẽ tự đọc `wrangler.toml` để lấy biến môi trường và binding R2.
4. Vào **Settings → Functions → R2 bucket bindings**: kiểm tra có `PHOTOS → giapha-photos`. Nếu chưa, thêm thủ công.
5. **Settings → Environment variables**: kiểm tra `SUPER_ADMIN_EMAIL`, `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `FIREBASE_AUTH_DOMAIN` (đã có từ `wrangler.toml`).

### 4. Gắn tên miền
Pages project → **Custom domains** → **Set up a custom domain** → nhập `giapha.tenmien.vn` (hoặc apex `tenmien.vn`). Cloudflare tự tạo bản ghi DNS và SSL.

### 5. Firebase: cho phép domain mới đăng nhập
1. console.firebase.google.com → project `gen-lang-client-0885231263` → **Authentication → Settings → Authorized domains** → **Add domain**: thêm domain của bạn và `<tên-project>.pages.dev`.
2. console.cloud.google.com → **APIs & Services → Credentials** → OAuth 2.0 Client (Web client của Firebase):
   - **Authorized JavaScript origins**: thêm `https://<domain>`
   - **Authorized redirect URIs**: thêm `https://<domain>/__/auth/handler`

### 6. Deploy Firestore rules và index
```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore
```
Lệnh này đẩy `firestore.rules` + `firestore.indexes.json` lên database `ai-studio-5efe7ae5-...` (khai báo trong `firebase.json`). Index có thể mất vài phút để build xong.

### 7. Giới hạn API key (khuyến nghị)
console.cloud.google.com → **Credentials** → API key `Browser key (auto created by Firebase)` → **Application restrictions: Websites** → thêm `https://<domain>/*`, `https://*.pages.dev/*`, `http://localhost:*/*`.

### 8. Kiểm tra
- Mở `https://<domain>`, F5 ở trang `/tree` không bị 404.
- Đăng nhập bằng email super admin → menu **Quản trị** hiện, tab **Người dùng** có.
- Đăng nhập bằng Google account khác → thấy banner "chờ duyệt". Super admin bấm **Duyệt** → tài khoản kia thấy menu Quản trị ngay, không cần F5.
- Trong Quản trị → Thêm thành viên → chọn ảnh → ảnh hiện với đường dẫn `/api/photos/...`.

## Cập nhật sau này
Chỉ cần `git push` lên nhánh production, Cloudflare Pages tự build và deploy. Rules Firestore thay đổi thì chạy lại bước 6.
