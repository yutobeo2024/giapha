# Gia Phả Họ Nguyễn Nhuận

Trang gia phả họ Nguyễn Nhuận: hành trình dòng họ dạng 3D, danh sách và sơ đồ cây hơn 1.500 người qua 21 đời, lịch kỵ nhật theo âm lịch, bài viết tư liệu, và trang quản trị để các chi tự cập nhật.

- Site: https://giaphanguyennhuan.com (cùng `www.` và `giapha-buu.pages.dev`)
- Stack: React 19 · Vite · Tailwind 4 · React Three Fiber · Firebase (Google Auth + Firestore, gói Spark) · Cloudflare Pages + Functions + R2

## Tính năng

| Trang | Đường dẫn | Nội dung |
|---|---|---|
| Tổng quan | `/` | Số đời, số người, người còn sống; sự kiện sắp tới; Bảng chi trưởng các địa phương; Hoạt động gần đây (5 mục mỗi trang) |
| Giới thiệu | `/gioi-thieu` | Hành trình dòng họ trên cây đa 3D theo chương (lời ở `src/data/introChapters.ts`), nhạc nền; chế độ **Khám phá 3D**: xoay/phóng, tìm người, chọn đời, bay tới người |
| Danh sách | `/members` | Thẻ thành viên, lọc theo đời, tìm không dấu; mỗi thẻ ghi "con ông …" và chi tộc |
| Cây gia phả | `/tree` | Sơ đồ cây mở sẵn đến đời 10 (bấm "+ N con" để mở tiếp); **Xuất PDF** phần đang mở hoặc **Xuất PDF nhánh này** từ khung chi tiết |
| Sự kiện | `/events` | Kỵ nhật, hội họp; nhập theo âm hoặc dương lịch, lặp hằng năm; tải về lịch (.ics) |
| Thông tin | `/thong-tin` | Bài viết tư liệu và liên kết bài báo; bài ghim lên đầu |
| Quản trị | `/admin` | Thành viên, Sự kiện, Bài viết, Người dùng, Cài đặt (nhạc nền, Bảng chi trưởng) |

## Vai trò người dùng

| Vai trò | Cách có | Quyền |
|---|---|---|
| Khách | không cần đăng nhập | xem toàn bộ gia phả và bài đã xuất bản |
| `user` | đăng nhập Google lần đầu | như khách, chờ duyệt |
| `editor` | admin duyệt trong tab **Người dùng** | thêm/sửa thành viên và sự kiện, tải ảnh |
| `admin` | super admin nâng quyền | tất cả, cộng: xóa dữ liệu, bài viết, cài đặt, duyệt/khóa người dùng |

Super admin là email cố định `hanhtoami@gmail.com`, khai báo ở **3 nơi phải giống nhau**: `src/config.ts`, `firestore.rules`, biến `SUPER_ADMIN_EMAIL` trong `wrangler.toml`. Cả ba nơi chỉ công nhận khi email **đã xác minh** (`email_verified`); đăng nhập Google luôn đạt điều kiện này.

## Dữ liệu và quy ước

### Collection Firestore

| Collection | Ai đọc | Ai ghi | Ghi chú |
|---|---|---|---|
| `members` | mọi người | editor (xóa: admin) | xem trường ở `src/types.ts` (`FamilyMember`) |
| `events` | mọi người | editor (xóa: admin) | `calendar: "solar" \| "lunar"`, `lunar {day, month, year, leap?}`, `recurring` |
| `activities` | mọi người | editor tạo, không sửa | nhật ký "Hoạt động gần đây" |
| `posts` | bài `published` | admin | id = đường dẫn `/thong-tin/<id>`; `kind: "article" \| "link"` |
| `settings` | mọi người | admin | `site` (nhạc nền trang Giới thiệu), `branchHeads` (Bảng chi trưởng) |
| `users` | chính chủ, admin | chính chủ tạo; admin đổi vai trò/khóa | không công khai, không sao lưu |

Luật đầy đủ và kiểm tra kiểu dữ liệu nằm ở `firestore.rules`.

### Đời và cha mẹ
- **Thủy tổ Nguyễn Hữu Chỉ là đời 1**, đời con = đời cha + 1 (cùng cách đếm với Kỷ yếu Nguyễn Hữu Tộc 2023). Bài phát biểu của Hội đồng Gia tộc đếm Tiên tổ Nguyễn Dũng Cảm là đời 1: muốn đổi sang cách đếm trên trang thì **cộng 3**.
- Biểu mẫu Quản trị không cho nhập đời tùy ý: chọn cha (hoặc mẹ) bằng ô gõ tên thì ô Đời tự tính và khóa; chỉ khi chưa rõ cha mẹ mới chọn tay. Khi lưu, web chặn nếu đời ≠ đời cha + 1, nếu chọn chính mình hoặc con cháu mình làm cha mẹ, hoặc nếu đổi đời của người đã có con cháu. Quy tắc nằm ở `src/lib/lineage.ts`.
- Sơ đồ cây và cây 3D lấy người đứng trên qua `treeParents()`: cha, không có thì mẹ. Người có cha đã bị xóa thành gốc riêng (không mất khỏi sơ đồ). Dữ liệu lỗi có vòng lặp cha–con thì cắt ở người đời thấp nhất trong vòng.
- Nhiều người trùng tên (ví dụ 14 bà Nguyễn Thị Huyền) là người khác nhau. Mọi ô tìm kiếm ghi "con ông …" để phân biệt.

### Chi tộc
Ô `branch` ghi theo Kỷ yếu, ví dụ `Chi ông Vinh (ông Nhuận Sĩ) - Phúc Thành`. Có 11 nhóm: chi ông Vinh, Thông, Tình, Hoàng, Long (Trinh), Quỳnh Lưu, Hùng-Loan, Hưng (Phổ), Niệm, Long (Trọng), và Nhánh Hậu Thành. Các cụ đời 1–10 là phần gốc chung nên để trống. Người nhập thử từ Kỷ yếu có tiểu sử mở đầu "Nhập thử từ kỷ yếu 2023, chờ chi xác nhận"; chỗ máy phải đoán cha ghi "Cần xác minh".

### Sự kiện âm lịch
Quy đổi âm–dương tự viết ở `src/lib/lunar.ts` (thuật toán Hồ Ngọc Đức, múi giờ UTC+7). Sự kiện âm lịch hiện ngày âm làm chính kèm dòng "Nhằm ngày … Dương lịch". Lặp hằng năm: tháng nhuận thì các năm sau làm vào tháng thường; ngày 30 gặp tháng thiếu thì làm ngày 29; ngày 29/2 dương lịch thì làm 28/2 (`src/lib/eventDates.ts`).

### Giới hạn đọc Firestore (gói Spark: 50.000 lượt/ngày)
Mỗi thành viên tính một lượt đọc, nên các trang công khai **không đọc thẳng collection `members`**. Chúng lấy `GET /api/members`, là một bản chụp toàn bộ danh sách lưu ở R2 (`giapha-photos/snapshots/members.json`):
- Bản chụp cũ hơn 6 giờ thì lần xem kế tiếp tự dựng lại từ Firestore.
- Biên tập viên lưu hoặc xóa một người trong Quản trị: web gọi `POST /api/members/refresh {id}` để vá đúng người đó vào bản chụp.
- Sửa hàng loạt bằng script thì xóa bản chụp để lần xem kế tiếp dựng lại ngay:
  ```bash
  npx wrangler r2 object delete giapha-photos/snapshots/members.json --remote
  ```
- `npm run dev` không có Functions nên đọc thẳng Firestore.

### Ảnh và tệp
Ảnh thành viên được thu nhỏ ở trình duyệt về 800px rồi lưu R2 qua `POST /api/photos`. Ảnh bài viết nằm dưới khóa `posts/`, nhạc nền dưới `audio/`. Tất cả phục vụ qua `GET /api/photos/<key>`, cache 1 năm.

## Chạy local và kiểm thử

```bash
npm install
npm run dev       # http://localhost:5173: chỉ front-end, đọc Firestore thật, không tải ảnh được
npm test          # node --test src/lib/*.test.ts test/*.test.ts (âm lịch, sự kiện, .ics, dàn trang PDF, phả hệ; Functions và Worker sao lưu với mạng giả lập)
npm run lint      # tsc cho src/, functions/ và backup-worker/
npm run build     # ra dist/
npm run preview   # wrangler pages dev dist → http://localhost:8788, có Functions + R2 giả lập
```

- `npm test` cần Node 22 trở lên (Node tự bỏ kiểu TypeScript). Trong `src/lib`, import giữa các file có bài thử phải ghi đuôi `.ts`.
- Khi thử giao diện có ghi dữ liệu, nên dùng Firebase emulator (`firebase emulators:start --only auth,firestore`) thay cho dữ liệu thật.

## Cấu trúc

```
src/
  App.tsx, main.tsx          định tuyến
  config.ts                  SUPER_ADMIN_EMAIL, tên miền chính cho Firebase Auth
  types.ts                   FamilyMember, FamilyEvent, Post, UserDoc, isAlive...
  firebase.ts                khởi tạo Firebase; handleFirestoreError trả thông báo tiếng Việt
  hooks/
    useAuth.ts, AuthContext.tsx   đăng nhập, tạo users/{uid}, theo dõi vai trò, khóa tài khoản
    useMembers.ts                 danh sách thành viên từ /api/members, giữ trong phiên
  lib/
    lineage.ts               đời từ cha, đếm con cháu, kiểm tra phả hệ khi lưu
    lunar.ts, eventDates.ts  âm lịch, lần diễn ra của sự kiện lặp
    treeLayout.ts, treePdf.ts dàn cây và chia tờ A3, vẽ PDF bằng jsPDF (font ở public/fonts)
    treeLayout3d.ts          bố cục cây đa 3D
    branchHeads.ts           Bảng chi trưởng (settings/branchHeads, 11 dòng mặc định)
    posts.ts, markdown.tsx   bài viết trang Thông tin, markdown rút gọn an toàn
    image.ts, avatar.ts, ics.ts, text.ts (foldText: bỏ dấu để tìm)
    *.test.ts                bài thử cho npm test
  components/
    Layout.tsx, BranchHeadsTable.tsx, RecentActivities.tsx, ErrorBoundary.tsx
    admin/                   ParentPicker, EventDateField, BranchHeadsEditor, PostsManager, Pager
    intro/                   TreeScene, ExploreBar, scene/* (cây, gió, nhãn, texture)
  data/
    introChapters.ts         lời các chương trang Giới thiệu
    seedMembers.ts           81 người đời 1–12 cho nút "Nạp dữ liệu gốc" (chỉ dùng khi dựng lại từ đầu)
  pages/                     Dashboard, Intro, MemberList, FamilyTree, Events, News, NewsDetail, Biography, Admin
functions/                   Cloudflare Pages Functions
  api/members/index.ts       GET bản chụp danh sách thành viên
  api/members/refresh.ts     POST làm mới bản chụp (editor)
  api/photos/index.ts        POST tải ảnh thành viên (editor)
  api/photos/[[path]].ts     GET ảnh / nhạc / ảnh bài viết từ R2
  api/media/index.ts         POST nhạc nền (admin)
  api/posts/link-preview.ts  POST đọc tiêu đề, ảnh của bài báo (admin)
  api/posts/import-image.ts  POST chép ảnh bài báo về R2 (admin)
  __/auth/[[path]].ts        proxy Firebase Auth về tên miền của site
  _lib/                      xác thực token, bản chụp members, tải trang ngoài an toàn
backup-worker/               Worker sao lưu hằng đêm (xem bên dưới)
scripts/
  restore-backup.mjs         khôi phục từ file sao lưu
  import-posts.mjs           nạp một đợt bài viết trong content/posts/<đợt>/
  fill-branch.mjs            chuyển chi tộc từ tiểu sử sang ô Chi tộc (đã chạy 16/10/2026)
test/                        test cho functions/ và backup-worker/ (không để trong functions/ vì Pages coi file ở đó là route)
content/posts/<đợt>/         bài viết soạn sẵn: posts.json, images/, README.md để duyệt
public/fonts/                Be Vietnam Pro (OFL) cho bản PDF
firestore.rules, firestore.indexes.json, firebase.json
wrangler.toml                Pages: biến môi trường, binding R2 PHOTOS → giapha-photos
```

## Đưa bản mới lên site

Pages project `giapha` dùng **tải trực tiếp (direct upload), không nối GitHub**, nên `git push` không tự đưa lên site.

1. Mở PR từ nhánh riêng (không push thẳng `main`), chạy `npm test`, `npm run lint`, rồi merge.
2. Trên `main` mới nhất: `npm run build`.
3. Đưa lên:
   ```bash
   npx wrangler pages deploy dist --project-name giapha --branch main --commit-dirty=true
   ```
4. Kiểm tra site đã chạy bản mới: tên file `assets/index-*.js` trong mã trang phải trùng với bản vừa build.
   ```bash
   curl -s https://giaphanguyennhuan.com/tree | grep -o 'assets/index-[^"]*\.js'
   ```

Sửa `firestore.rules` hoặc `firestore.indexes.json` thì đẩy riêng bằng `npx firebase-tools deploy --only firestore` (tài khoản Firebase CLI là chủ project).

## Script vận hành

Các script ghi dữ liệu thật đều dùng tài khoản Firebase CLI đã đăng nhập trên máy (`npx firebase-tools login`, tài khoản super admin) và **mặc định chỉ xem trước**; thêm `--apply` mới ghi.

| Script | Việc |
|---|---|
| `node scripts/restore-backup.mjs <file> [--collections …] [--only id1,id2] [--apply]` | Khôi phục từ file sao lưu (mặc định `members`, `events`; thêm `--collections posts,settings` cho bài viết và cài đặt). Không xóa bản ghi đang có, chỉ tạo lại bản bị mất và ghi đè bản trùng id |
| `node scripts/import-posts.mjs content/posts/<đợt> [--apply] [--overwrite]` | Tải ảnh của đợt bài lên R2 (qua wrangler) và ghi bài vào `posts`; bài đã có được giữ nguyên trừ khi `--overwrite` |
| `node scripts/fill-branch.mjs [--apply] [--keep-sentence]` | Điền ô Chi tộc từ câu "Chi ông …" trong tiểu sử. Luôn sao lưu toàn bộ `members` ra `D:\GIA PHẢ\backup-members-truoc-dien-chi-<giờ>.json` trước khi ghi |

Sau khi script sửa `members`, xóa bản chụp `/api/members` (lệnh ở mục "Giới hạn đọc Firestore" phía trên) để trang ngoài thấy ngay.

## Sao lưu và khôi phục

Worker riêng `giapha-backup` (thư mục `backup-worker/`) chạy **mỗi đêm lúc 02:00 giờ Việt Nam** (cron `0 19 * * *` UTC). Worker đọc các collection ghi trong biến `COLLECTIONS` của `backup-worker/wrangler.toml` (hiện là `members,events,activities,posts,settings`) qua Firestore REST, rồi ghi một file JSON vào bucket R2 `giapha-backups`:

| Thư mục | Nội dung | Giữ |
|---|---|---|
| `daily/YYYY-MM-DD.json` | Bản mỗi đêm | 60 ngày gần nhất |
| `monthly/YYYY-MM.json` | Bản đầu tiên của mỗi tháng | Vĩnh viễn |

Worker đọc không cần khóa (rules cho đọc công khai), nên:
- `posts` chỉ sao lưu bài **đã xuất bản**. Bài nháp không nằm trong bản sao lưu; bản gốc các đợt bài soạn sẵn có trong `content/posts/`.
- `users` (hồ sơ đăng nhập, vai trò) không được sao lưu. Nếu mất, người dùng đăng nhập lại và admin duyệt lại.

Ảnh nằm trên R2 `giapha-photos`, vốn được Cloudflare lưu bền.

**Đưa Worker lên** (một lần, hoặc khi sửa `backup-worker/`):
```bash
npx wrangler deploy --config backup-worker/wrangler.toml
```

**Tải bản sao lưu:** Cloudflare dashboard → R2 → `giapha-backups` → chọn file → Download. Hoặc:
```bash
npx wrangler r2 object get giapha-backups/daily/2026-10-15.json --remote --file backup.json
```

**Chạy sao lưu ngay:** dashboard → Workers & Pages → `giapha-backup` → Settings → Trigger events → chạy thử cron.

**Khôi phục:**
```bash
node scripts/restore-backup.mjs backup.json                               # xem trước, không ghi gì
node scripts/restore-backup.mjs backup.json --apply                       # ghi lại members + events
node scripts/restore-backup.mjs backup.json --only nguyen-huu-chi --apply # chỉ khôi phục 1 người
node scripts/restore-backup.mjs backup.json --collections posts,settings  # bài viết và cài đặt (mặc định chỉ members, events)
```

Các file `D:\GIA PHẢ\backup-members-*.json` do script tạo ra trước mỗi lần sửa hàng loạt. File có tên `...truoc-dien-chi-...` cùng định dạng với backup-worker nên `restore-backup.mjs` đọc được. Các file cũ hơn là định dạng thô của Firestore.

## Dựng lại từ đầu (gói Cloudflare Free)

Chỉ cần khi dựng site mới hoặc chuyển tài khoản. Site hiện tại đã cấu hình xong.

1. **Tên miền về Cloudflare:** dash.cloudflare.com → Add a site → gói Free → đổi nameserver ở nhà cung cấp tên miền → chờ Active.
2. **R2:** tạo bucket `giapha-photos` (ảnh, nhạc, bản chụp members) và `giapha-backups` (sao lưu). Tên phải trùng `wrangler.toml` và `backup-worker/wrangler.toml`.
3. **Pages:** tạo project `giapha` dạng Direct Upload, rồi `npm run build` và chạy lệnh đưa lên ở trên. Sau đó vào Settings → Functions → R2 bindings, kiểm tra có `PHOTOS → giapha-photos`. Vào Environment variables, kiểm tra có `SUPER_ADMIN_EMAIL`, `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `FIREBASE_AUTH_DOMAIN`.
4. **Tên miền riêng:** Pages → Custom domains → thêm `giaphanguyennhuan.com` và `www.giaphanguyennhuan.com`.
5. **Firebase Auth:** console.firebase.google.com → project `gen-lang-client-0885231263` → Authentication → Settings → Authorized domains: thêm tên miền và `giapha-buu.pages.dev`. Ở console.cloud.google.com → Credentials → OAuth 2.0 Web client:
   - Authorized JavaScript origins: thêm `https://<tên miền>`
   - Authorized redirect URIs: thêm `https://<tên miền>/__/auth/handler`
6. **Rules và index:** `npx firebase-tools deploy --only firestore` (database `ai-studio-5efe7ae5-...` khai báo trong `firebase.json`).
7. **Khóa API theo website:** Credentials → Browser key → Application restrictions: Websites → thêm `https://<tên miền>/*`, `https://*.pages.dev/*`, `http://localhost:*/*`.
8. **Sao lưu:** đưa Worker `giapha-backup` lên (xem trên).
9. **Kiểm tra:**
   - F5 ở `/tree` không bị 404.
   - Đăng nhập bằng email super admin thì menu Quản trị hiện ra.
   - Đăng nhập tài khoản khác thì thấy "chờ duyệt". Duyệt xong, tài khoản đó thấy Quản trị ngay mà không cần F5.
   - Tải ảnh thành viên thì ảnh có đường dẫn `/api/photos/...`.
   - Xuất PDF ở Cây gia phả tải được file.
