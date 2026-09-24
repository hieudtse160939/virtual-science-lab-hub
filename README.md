# Virtual Science Lab Hub

Thư viện và cổng truy cập **mô phỏng / thí nghiệm ảo cho giáo dục K-12** (Toán, Vật lý, Hóa học, Sinh học, Khoa học Trái đất, Môi trường, Tin học, STEM).
Giáo viên có thể **Tìm kiếm → Lọc → Mở mô phỏng → Lưu → Tạo bộ sưu tập → Chia sẻ cho học sinh** chỉ trong vài thao tác.

> Ứng dụng **chỉ lưu metadata và liên kết** tới nhà cung cấp (PhET, ChemCollective, Concord Consortium, LabXchange, NOVA Labs…).
> Không sao chép, không tải về, không proxy nội dung mô phỏng của bên thứ ba.

---

## Mục lục

1. [Tính năng](#1-tính-năng)
2. [Kiến trúc](#2-kiến-trúc)
3. [Cài đặt & chạy local](#3-cài-đặt--chạy-local)
4. [Thiết lập Supabase](#4-thiết-lập-supabase)
5. [Migration & seed data](#5-migration--seed-data)
6. [Biến môi trường](#6-biến-môi-trường)
7. [Nhập dữ liệu (Import)](#7-nhập-dữ-liệu-import)
8. [Tạo tài khoản admin](#8-tạo-tài-khoản-admin)
9. [Deploy lên Vercel + tên miền riêng](#9-deploy-lên-vercel--tên-miền-riêng)
10. [Hiệu năng & khả năng mở rộng](#10-hiệu-năng--khả-năng-mở-rộng)
11. [Bảo mật](#11-bảo-mật)
12. [Bản quyền & giấy phép](#12-bản-quyền--giấy-phép)
13. [API](#13-api)
14. [Cấu trúc thư mục](#14-cấu-trúc-thư-mục)

---

## 1. Tính năng

| Nhóm                              | Chi tiết                                                                                                                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tìm kiếm**                      | Full-text search (PostgreSQL FTS, stemming tiếng Anh + tiếng Việt không dấu), fuzzy/chịu lỗi chính tả (`pg_trgm`), gõ dở (tiền tố), **từ đồng nghĩa song ngữ** ("định luật Ohm" → Ohm's Law, Circuit Construction Kit…), autocomplete (truy vấn phổ biến + mô phỏng), xếp hạng tổng hợp |
| **Bộ lọc**                        | Môn, cấp học, khối 1–12, ngôn ngữ, nguồn, loại, giấy phép, thời lượng, chỉ miễn phí, chỉ đã xác minh — tất cả phía server, lưu trên URL (chia sẻ được)                                                                                                                                  |
| **Trang chủ**                     | Hero + ô tìm kiếm lớn, khám phá theo môn, hàng "Phổ biến" / "Mới cập nhật" kiểu Netflix, bộ sưu tập giáo viên                                                                                                                                                                           |
| **Chi tiết** `/simulation/[slug]` | Đầy đủ metadata, mục tiêu học tập, giấy phép, nguồn, mô phỏng liên quan, SEO (title, description, OpenGraph, canonical, JSON-LD `LearningResource`)                                                                                                                                     |
| **Trình xem** `/lab/[slug]`       | Nhúng iframe **chỉ khi nhà cung cấp cho phép**; server kiểm tra `X-Frame-Options`/CSP `frame-ancestors` và **tôn trọng** chúng; toàn màn hình, mở bản gốc, báo lỗi; responsive cho bảng tương tác                                                                                       |
| **Giáo viên** `/teacher`          | Bộ sưu tập, yêu thích, dùng gần đây, hoạt động học sinh (ẩn danh), sắp xếp/ghi chú, chia sẻ link, **tạo phiếu hoạt động 5E** in được                                                                                                                                                    |
| **Admin** `/admin`                | Thống kê + biểu đồ (theo môn/nguồn/khối/ngôn ngữ, 30 ngày), top 20 mô phỏng, top từ khóa, từ khóa không có kết quả; thêm/sửa/xóa/ẩn; cập nhật hàng loạt; hàng chờ duyệt; import CSV/JSON/JSONL; quản lý nguồn, môn; phát hiện trùng lặp; xử lý báo lỗi                                  |
| **Metadata tự động**              | Bộ phân loại theo quy tắc (song ngữ) gợi ý môn, khối, chủ đề, loại, độ khó, ngôn ngữ, từ khóa. Bản ghi được gợi ý tự động vào **hàng chờ duyệt**                                                                                                                                        |
| **Khác**                          | Đăng nhập email/mật khẩu (Supabase Auth), vai trò student/teacher/admin, i18n Việt/Anh, sáng/tối (mặc định sáng), cỡ chữ, tương phản cao, sitemap, robots                                                                                                                               |

## 2. Kiến trúc

```
Trình duyệt ──► Next.js 15 (App Router, Vercel)
                 ├─ Server Components (đọc dữ liệu, cache unstable_cache)
                 ├─ Route Handlers /api/*  (zod validate, rate limit, lỗi JSON thống nhất)
                 └─ src/server/repositories/*   ◄── lớp truy cập dữ liệu (abstraction layer)
                          │
                          ▼
                 Supabase: PostgreSQL + PostgREST + Auth
                   ├─ RLS cho mọi bảng
                   ├─ RPC: search_simulations, import_simulations, admin_dashboard_stats…
                   └─ FTS (tsvector, GIN) + pg_trgm + unaccent
```

**Nguyên tắc chính**

- **Không hard-code dữ liệu ở frontend.** Mọi danh sách (môn, nguồn, mô phỏng…) đọc từ DB.
- **Lớp repository** (`src/server/repositories`) là nơi duy nhất nói chuyện với Supabase. Muốn chuyển sang PostgreSQL/Neon hoặc backend khác: viết lại các hàm trong thư mục này (logic SQL nằm trong migration, chạy được trên PostgreSQL thuần).
- **Không bao giờ trả toàn bộ dữ liệu**: API giới hạn ≤ 60 bản ghi/lần, keyset pagination cho sắp xếp theo mới nhất/phổ biến/tên, đếm tổng được giới hạn 10.000.
- **Analytics không thu thập dữ liệu cá nhân**: chỉ lưu số liệu tổng hợp theo ngày (không IP, không định danh người xem). Lịch sử "Dùng gần đây" chỉ lưu cho chính người dùng đã đăng nhập.

**Stack**: Next.js 15 · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · Supabase (PostgreSQL, Auth, RLS) · zod · PapaParse · TanStack Virtual.

## 3. Cài đặt & chạy local

Yêu cầu: **Node.js ≥ 20**, một dự án Supabase (miễn phí).

```bash
npm install
cp .env.example .env.local      # rồi điền giá trị (xem mục 6)
npm run dev                     # http://localhost:3000
```

Các lệnh khác:

| Lệnh                                                    | Mô tả                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run build` / `npm start`                           | Build & chạy production                                                         |
| `npm run lint` · `npm run typecheck` · `npm run format` | ESLint · TypeScript · Prettier                                                  |
| `npm run seed:generate`                                 | Sinh lại `supabase/seed.sql` + `data/seed-simulations.json` từ `scripts/seed/*` |
| `npm run demo:generate -- --count 100000`               | Sinh dữ liệu **tổng hợp** kiểm thử hiệu năng (xem mục 10)                       |

## 4. Thiết lập Supabase

1. Tạo dự án tại <https://supabase.com/dashboard> (khuyên dùng region **Southeast Asia (Singapore)**).
2. **Project Settings → API**: lấy `Project URL`, `anon public key`, `service_role key`.
3. **Authentication → Providers → Email**: bật Email. Có thể tắt "Confirm email" khi thử nghiệm.
4. **Authentication → URL Configuration**:
   - _Site URL_: `https://ten-mien-cua-ban.vn` (hoặc `http://localhost:3000` khi dev)
   - _Redirect URLs_: thêm `https://ten-mien-cua-ban.vn/auth/callback` và `http://localhost:3000/auth/callback`
5. (Mở rộng) Google/Microsoft: bật provider tương ứng trong **Authentication → Providers**; route `/auth/callback` đã hỗ trợ luồng PKCE.

## 5. Migration & seed data

Chạy **theo thứ tự** các file trong `supabase/migrations/`:

| File                                | Nội dung                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `…0001_core_schema.sql`             | Extension (`pg_trgm`, `unaccent`), kiểu dữ liệu, bảng, trigger chuẩn hóa/tìm kiếm, index |
| `…0002_search_analytics_import.sql` | Search engine, analytics tổng hợp, import hàng loạt, thống kê admin, phát hiện trùng     |
| `…0003_rls_policies.sql`            | Row Level Security + quyền thực thi hàm                                                  |
| `…0004_reference_data.sql`          | Môn học, khối 1–12, từ điển đồng nghĩa Việt → Anh                                        |

Sau đó chạy `supabase/seed.sql` (**141 mô phỏng thật** từ 18 nguồn mở).

**Cách 1 – SQL Editor**: dán lần lượt từng file vào _SQL Editor_ và bấm _Run_.

**Cách 2 – Supabase CLI**:

```bash
npx supabase login
npx supabase init                          # chỉ lần đầu (tạo supabase/config.toml, giữ nguyên thư mục migrations)
npx supabase link --project-ref <project-ref>
npx supabase db push                      # chạy migrations
psql "<connection-string>" -f supabase/seed.sql
```

> Seed data: mô phỏng PhET dùng liên kết HTML5 chính thức (giấy phép CC BY 4.0, cho phép nhúng) và được đánh dấu _Đã xác minh_.
> Các nguồn khác được seed với `is_verified = false` để admin kiểm tra lại liên kết trước khi gắn nhãn xác minh.

## 6. Biến môi trường

| Biến                            | Bắt buộc       | Mô tả                                                                                                                          |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✔              | URL dự án Supabase                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔              | Anon key (an toàn để lộ ở client – RLS bảo vệ dữ liệu)                                                                         |
| `NEXT_PUBLIC_SITE_URL`          | ✔              | URL công khai, dùng cho canonical, sitemap, OpenGraph, link chia sẻ                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | chỉ cho script | Dùng bởi `scripts/generate-demo-data.ts`. **Ứng dụng web không dùng khóa này.** Không commit, không đặt tiền tố `NEXT_PUBLIC_` |

## 7. Nhập dữ liệu (Import)

Trang **Admin → Nhập dữ liệu** (`/admin/import`) hỗ trợ **CSV, JSON (mảng hoặc `{ "simulations": [...] }`), JSONL**, tệp tới 200 MB.

Quy trình:

1. Tệp được đọc **theo luồng ngay trên trình duyệt** (không tải cả tệp lên server – tránh giới hạn body 4,5 MB của Vercel).
2. Mỗi dòng được **chuẩn hóa & kiểm tra**: tên cột tiếng Việt/Anh, tạo slug, map môn học (theo tên/alias), map khối (`7-12`, `THCS`, `Lớp 10`…), map nguồn (tạo mới nếu chưa có), ngôn ngữ, loại, giấy phép, thời lượng (`15 phút`, `1h`), tách từ khóa, gợi ý metadata còn thiếu.
3. **Phát hiện trùng**: trong tệp và với cơ sở dữ liệu (theo URL đã chuẩn hóa).
4. Màn hình xem trước: _Số bản ghi phát hiện / Hợp lệ / Trùng lặp / Lỗi_, danh sách lỗi theo dòng (virtualized), tải báo cáo lỗi CSV.
5. Nhập theo **lô 500 bản ghi, 3 lô song song**, mỗi lô là **một lời gọi RPC hàng loạt** (`import_simulations`). Server kiểm tra lại toàn bộ bằng zod. Lô lỗi mạng được tự thử lại 3 lần; sau cùng có nút **"Thử lại các lô lỗi"**. Mỗi lần nhập được ghi vào `import_jobs`.

Định dạng CSV:

```
title,description,subject,grade_min,grade_max,topic,source_name,source_url,simulation_url,embed_url,language,license,tags
```

Cột tùy chọn: `slug, short_description, sub_subject, subtopic, simulation_type, thumbnail_url, license_url, license_category, difficulty, duration_minutes, learning_objectives, required_equipment, is_free, is_verified, is_featured`.
Danh sách phân tách bằng `|` hoặc `;` (từ khóa có thể dùng dấu phẩy). Tải tệp mẫu ngay trên trang import. `data/seed-simulations.json` là ví dụ JSON đầy đủ.

## 8. Tạo tài khoản admin

1. Đăng ký tài khoản bình thường trên website.
2. Trong Supabase **SQL Editor**:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin@truong.edu.vn');
```

Người dùng chỉ có thể tự chuyển giữa _học sinh ↔ giáo viên_ (trang Tài khoản); quyền admin **chỉ** cấp được bằng SQL (trigger `protect_profile_role`).

## 9. Deploy lên Vercel + tên miền riêng

1. Đẩy mã nguồn lên GitHub/GitLab.
2. <https://vercel.com/new> → Import repository (Framework: Next.js — đã có `vercel.json`, region `sin1`).
3. Thêm biến môi trường: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL=https://ten-mien-cua-ban.vn`.
4. Deploy.
5. **Tên miền riêng**: Vercel → Project → _Settings → Domains_ → thêm tên miền, cấu hình DNS (`A 76.76.21.21` cho tên miền gốc hoặc `CNAME cname.vercel-dns.com` cho subdomain).
6. Cập nhật lại **Site URL** và **Redirect URLs** trong Supabase Auth (mục 4) theo tên miền mới, và `NEXT_PUBLIC_SITE_URL` trên Vercel, rồi redeploy.
7. Gửi `https://ten-mien-cua-ban.vn/sitemap.xml` lên Google Search Console.

## 10. Hiệu năng & khả năng mở rộng

Thiết kế cho 10k → 100k → 500k → 1M bản ghi mà không phải viết lại:

- **Index**: GIN cho `search_vector`, trigram cho tiêu đề/văn bản tìm kiếm/URL, GIN cho `tags`; partial index cho mọi bộ lọc trên tập "đang hiển thị"; index keyset `(created_at, id)`, `(view_count, id)`, `(title_search, id)`.
- **Tìm kiếm 2 bước**: bước 1 dùng FTS + từ đồng nghĩa (qua GIN index); chỉ khi không có kết quả mới nới lỏng sang OR + so khớp mờ trigram trên tiêu đề. Đếm tổng giới hạn 10.000 ("Hơn 10.000 kết quả").
- **Cache**: danh mục, số liệu, trang chi tiết, trang chủ dùng `unstable_cache` (5–60 phút) + `revalidateTag` khi admin thay đổi dữ liệu. API gợi ý có cache CDN.
- **Frontend**: không tải toàn bộ DB; phân trang cursor + tải thêm khi cuộn; `content-visibility` cho danh sách dài; virtualized list cho danh sách lỗi import; debounce 200ms cho autocomplete; `next/image` tối ưu ảnh.
- **Sitemap** dạng index, mỗi tệp ≤ 40.000 URL.

**Kiểm thử hiệu năng với dữ liệu tổng hợp** (luôn `is_demo = true`, tiêu đề "DEMO …", URL tên miền `.invalid`; bị ẩn khỏi tìm kiếm công khai, sitemap và thống kê danh mục):

```bash
npm run demo:generate -- --count 100000            # tạo data/demo-100000.jsonl → import với tùy chọn "demo"
npm run demo:generate -- --count 100000 --insert   # chèn trực tiếp (cần SUPABASE_SERVICE_ROLE_KEY)
npm run demo:generate -- --cleanup                 # xóa toàn bộ dữ liệu demo
```

Admin xem kết quả có dữ liệu demo tại `/search?demo=1`.

## 11. Bảo mật

- **RLS** bật trên mọi bảng; khách chỉ đọc mô phỏng đã xuất bản và bộ sưu tập công khai; yêu thích/lịch sử chỉ của chính mình; chỉ giáo viên tạo bộ sưu tập; chỉ admin ghi dữ liệu danh mục.
- API admin dùng **phiên đăng nhập của người dùng** (RLS + kiểm tra `is_admin()` trong RPC), không dùng service role.
- Mọi đầu vào được validate bằng **zod**; tham số RPC truyền qua `USING` (không nối chuỗi SQL); redirect sau đăng nhập chỉ cho phép đường dẫn nội bộ.
- Giới hạn tần suất theo IP cho tìm kiếm, theo dõi, báo lỗi, yêu thích.
- Header bảo mật: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`.
- iframe nhúng dùng `sandbox` + `referrerpolicy`.

## 12. Bản quyền & giấy phép

- Chỉ lưu: tiêu đề, mô tả **do dự án tự biên soạn**, phân loại, URL, thumbnail URL (ảnh do nhà cung cấp phục vụ), giấy phép và liên kết giấy phép.
- Mỗi mô phỏng hiển thị **Nguồn, URL nguồn, Giấy phép** và thông báo "Mô phỏng bên ngoài – mở trên trang web của nhà cung cấp".
- Chỉ nhúng iframe khi nguồn được đánh dấu **cho phép nhúng** (`sources.allows_embed`) **và** header của nhà cung cấp không chặn. Ứng dụng **không** vượt qua CORS, CSP, X-Frame-Options, xác thực hay DRM.
- Dữ liệu tổng hợp luôn được đánh dấu `is_demo` và không bao giờ được trình bày như mô phỏng thật.

## 13. API

| Phương thức     | Đường dẫn                                                                                     | Mô tả                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET             | `/api/simulations`                                                                            | Duyệt có bộ lọc, cursor pagination                                                                                                          |
| GET             | `/api/simulations/[id]`                                                                       | Chi tiết (UUID hoặc slug)                                                                                                                   |
| GET             | `/api/search`                                                                                 | Tìm kiếm (`q`, `subject`, `level`, `grade`, `lang`, `source`, `type`, `license`, `duration`, `free`, `verified`, `sort`, `cursor`, `limit`) |
| GET             | `/api/search/suggest`                                                                         | Autocomplete                                                                                                                                |
| GET             | `/api/subjects` · `/api/grades` · `/api/sources`                                              | Danh mục                                                                                                                                    |
| GET/POST        | `/api/collections`                                                                            | Bộ sưu tập của tôi / tạo mới (`?scope=public` để xem công khai)                                                                             |
| PATCH/DELETE    | `/api/collections/[id]`                                                                       | Sửa/xóa                                                                                                                                     |
| POST            | `/api/collections/[id]/items`                                                                 | Thêm/bỏ/sắp xếp/ghi chú                                                                                                                     |
| GET/POST/DELETE | `/api/favorites`                                                                              | Yêu thích                                                                                                                                   |
| POST            | `/api/track` · `/api/reports`                                                                 | Thống kê ẩn danh · báo lỗi                                                                                                                  |
| POST            | `/api/admin/import` (+ `/check`, `/jobs`)                                                     | Import hàng loạt                                                                                                                            |
| POST            | `/api/admin/simulations` (+ `/bulk`)                                                          | Thêm · cập nhật hàng loạt                                                                                                                   |
| PATCH/DELETE    | `/api/admin/simulations/[id]`                                                                 | Sửa/xóa                                                                                                                                     |
| …               | `/api/admin/sources`, `/api/admin/subjects`, `/api/admin/reports/[id]`, `/api/admin/classify` | Quản trị                                                                                                                                    |

Lỗi luôn trả JSON `{ "error": "<code>" }` với mã HTTP phù hợp (400/401/403/404/409/429/503).

## 14. Cấu trúc thư mục

```
supabase/migrations/      Schema, search engine, RLS, dữ liệu tham chiếu
supabase/seed.sql         141 mô phỏng thật (sinh từ scripts/seed)
scripts/                  Sinh seed SQL, sinh dữ liệu demo
src/app/(site)/           Các trang có header/footer
src/app/lab/[slug]/       Trình xem toàn màn hình
src/app/api/              Route handlers
src/components/           UI (ui/ = shadcn-style primitives)
src/lib/                  i18n, import (parse/normalize), phân loại metadata, validate, tiện ích
src/server/               Auth, HTTP helpers, repositories (lớp truy cập dữ liệu), kiểm tra nhúng
```
