# Progress Log

> Nhật ký work session. Mỗi lần ngồi xuống code → cập nhật mục mới nhất.
> Mục đích: 1 tuần sau quay lại không lạc đường.
> Đọc cùng với README.md (status cao cấp) và BACKLOG.md (việc sắp tới).

---

## 2026-06-01 — Checkpoint 2.1: MinIO infrastructure (chưa code feature)

**Done:**
- Thêm service `minio` vào `backend/docker-compose.yml` (image `minio/minio:latest`, ports 9000 API / 9001 console, creds dev `minio`/`minio12345`, healthcheck `mc ready local`) + volume `minio_data`.
- Thêm 6 S3 env vars vào `.env.example` (`S3_ENDPOINT/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET/PUBLIC_URL`).
- Cập nhật `backend/CLAUDE.md` section Storage: service name, creds default, access model (bucket public-read cho đọc, presigned PUT cho upload).
- Verify hạ tầng qua console UI: tạo bucket `social-media-media`, set public-read, upload + share URL OK.

**Lưu ý kỹ thuật:**
- Bucket MinIO mặc định private → share URL trả 403. Phải set Access Policy public-read (prefix `*`, readonly) thủ công sau khi tạo bucket. Access model chốt: **đọc** ảnh qua `S3_PUBLIC_URL` trực tiếp (không sign, giảm latency feed), **upload** mới qua presigned PUT.
- `.env.example` bị permission settings chặn đọc/ghi (match `.env*`) → Claude không Edit được, user paste tay snippet.
- Postgres map host port 25432→5432; MinIO map thẳng 9000/9001.

**Tech debt phát sinh:** `[backend/storage]` creds MinIO hardcode trong docker-compose (dev only) → BACKLOG. (Automate MinIO setup đã có sẵn trong BACKLOG.)

**Next:** Checkpoint 2.2 — cài `@aws-sdk/client-s3` + `s3-request-presigner`, tạo `lib/s3.ts`, module `media/` với `POST /media/presign`, validate S3 vars trong `config/env.ts`.

---

## 2026-05-30 — Frontend Phase 1B: Design system "Beng" + layout shell + dark mode

**Done:**
- Override toàn bộ shadcn token Nova (zinc base, primary tím) → warm-neutral + coral trong `index.css` (`:root` + `.dark`, oklch hue 32–60, radius 0.625→0.75). 5 component shadcn (button/card/input/form/label) tự đổi theme, không rewrite.
- Đổi font: gỡ `@fontsource-variable/geist` → Bricolage Grotesque (heading) + Plus Jakarta Sans (body) qua Google Fonts.
- Dark mode JS layer: `themeStore` (Zustand persist key `theme`), `useThemeEffect` (toggle `.dark` trên `<html>`), `ThemeToggle`, FOUC inline script trong `index.html`.
- Layout shell mới (`components/layout/`): `AppLayout` (Sidebar | main | RightRail + BottomNav mobile), `AuthLayout` (split coral panel); lồng vào guard route trong `App.tsx`.
- 4 page restyle giữ nguyên logic auth/validation/mutation: Login/Register vào AuthLayout; Home bỏ header + `useQuery` orphan → story bar + feed placeholder; Profile header + stats + posts grid.
- Story bar IG-style: `scrollbar-hide`, ~6 story/view, arrow hover-show + auto-hide theo `canScrollLeft/Right`, scroll đo runtime (`offsetWidth` + `gap` × 3 item) thay px hardcode.

**Lưu ý kỹ thuật:**
- Token override đủ restyle vì cả 5 shadcn component 100% semantic token, không hardcode màu (verify trước khi sửa).
- `--destructive-foreground` thêm vào `:root`/`.dark` + map `--color-destructive-foreground` trong `@theme inline`, nhưng button destructive đang dùng style subtle (`bg-destructive/10 text-destructive`) nên chưa đổi visual — token để sẵn.
- FOUC script đọc `stored.state.theme` (Zustand persist bọc `{state,version}`), không phải `stored.theme`.
- Story scroll step đo item đầu `[data-story-item]`; cân bằng your-story `size-17` (68px) khớp story thường (ring 64+4=68) + `gap-6.5` để tránh drift, thay vì đo riêng item normal.
- AppLayout/AuthLayout lồng trong ProtectedRoute/PublicOnlyRoute (cả hai render `<Outlet/>`).

**Tech debt phát sinh (đề xuất append BACKLOG):**
- `[frontend/a11y]` ThemeToggle đổi `<Button>` → `<div onClick>`: mất button semantics, keyboard access (Tab/Enter/Space) và focus ring. Revert về `<button>` hoặc thêm `role="button"`/`tabIndex`/`onKeyDown`.
- `[frontend/layout]` Story bar `useEffect` init chỉ chạy lúc mount, không re-check khi resize → `canScrollRight` có thể stale khi đổi viewport. Cân nhắc `ResizeObserver`.
- `[frontend/nav]` Nav placeholder (Search/Explore/Reels/Messages/Notifications/Create/Settings) đang disabled visual, chưa có route — Phase 2+ wire route thật.

**Next:** Verify browser-interactive (light/dark/mobile, FOUC reload, story scroll trọn item). Sau đó Phase 2 — posts (model + API + feed thật).

---

## 2026-05-28 — Frontend Phase 1A: Foundation

**Done:**
- Scaffold Vite + React + TS trong `frontend/`, path alias `@` → `src/`, shadcn init (preset Nova, Tailwind v4 CSS-first)
- axios client với request interceptor (gắn Bearer) + response interceptor (401 → refresh → retry; refresh fail → `logout()`)
- Zustand `authStore` (persist localStorage), TanStack Query (QueryClient + Provider + DevTools dev-only)
- React Router 6: `ProtectedRoute` + `PublicOnlyRoute`, 4 page placeholder (`/login`, `/register`, `/`, `/profile`)
- `types/api.ts` viết tay khớp response backend; `HomePage` có `useQuery(['me'])` smoke test
- Verify code-level pass: `tsc -b` + `npm run build` 0 lỗi; contract API khớp (register/login `identifier`/me Bearer/refresh) qua curl. 3 bước browser-interactive chờ test thủ công.

**Lưu ý kỹ thuật:**
- create-vite latest kéo React 19 + Vite 8 (rolldown) + TS 6 → pin cứng về **React 18 + Vite 5 + TS 5.6 + React Router 6**. Vite 8 rolldown vỡ trên Node 22.1.0 (thiếu native binding `@rolldown/binding-win32-x64-msvc`, cần Node ≥22.12).
- Tailwind v4 = CSS-first: KHÔNG có `tailwind.config.js`, theme nằm trong `src/index.css` qua `@theme`, color space oklch (zinc base).
- shadcn init thêm `@import "shadcn/tailwind.css"` vào index.css nhưng package `shadcn` chỉ là CLI (đã gỡ khỏi deps) → phải xóa import đó nếu không build fail.
- TS 5.6 không biết `erasableSyntaxOnly` (option TS 5.8+) → gỡ khỏi tsconfig.app/node.
- Interceptor dùng refresh-promise singleton cho concurrent 401; KHÔNG redirect trong axios (chỉ `logout()`, ProtectedRoute tự redirect).

**Tech debt phát sinh (đã append BACKLOG):**
- `[frontend/auth]` Token lưu localStorage → XSS đọc được; Phase polish chuyển refresh token sang httpOnly cookie.

**Next:** Phase 1B — UI auth form thực (react-hook-form + Zod, login/register/profile), `npx shadcn@latest add` các component v4. Nâng Node lên ≥22.12 để bỏ warning Vite.

---

## 2026-05-27 — Swagger UI schema-first (Zod → OpenAPI)

**Done:**
- Tích hợp `@asteasolutions/zod-to-openapi` + `swagger-ui-express`, serve `/docs` và `/docs/json` (dev-only gate qua `NODE_ENV`)
- `lib/openapi.ts` làm registry trung tâm + `extendZodWithOpenApi(z)` + security scheme `bearerAuth` + shared schemas (`User`, `Error`, `ValidationError`)
- 3 file `*.openapi.ts` per-feature (auth, users, health/Meta) đăng ký paths từ Zod schema gốc, không sửa `*.schema.ts`
- Tags array document-level cố định thứ tự Auth → Users → Meta
- Verify 9/9 pass: spec valid, $ref dùng đúng, refresh-token-as-access trả 401, prod mode `/docs` 404

**Lưu ý kỹ thuật:**
- Pin `@asteasolutions/zod-to-openapi@^7.3.0` — v8 latest peer-deps Zod ^4 (project đang Zod 3.23)
- Circular import `lib/openapi` ↔ `modules/*/openapi` (registry export schema + paths import lại schema) → giải bằng lazy `require()` trong `registerAll()`, không bằng dynamic ESM import (tsx CJS context)
- `servers` URL và log dùng `localhost` thay `env.HOST` vì HOST mặc định `0.0.0.0` không gọi được từ browser
- Path params phải dùng cú pháp OpenAPI `{username}`, không reuse Express `:username`

**Tech debt phát sinh (đề xuất append vào BACKLOG.md):**
- JWT verify error message gộp chung: refresh-token-as-access và expired-token đều trả `"Token không hợp lệ hoặc đã hết hạn"` — nên phân biệt `TokenTypeMismatch` vs `TokenExpired` ở `lib/jwt.ts` để client biết retry-with-refresh hay buộc re-login
- `userPublicSchema` trong `lib/openapi.ts` đang duplicate field list với `publicUserSelect` của Prisma — khi thêm field mới (vd `followersCount`) phải sửa 2 chỗ; cân nhắc derive từ Prisma type sau khi có generator
- `buildOpenApiDocument()` chạy 1 lần khi mount — nếu cần hot-reload paths trong dev cần chuyển sang gọi mỗi request `/docs/json` (chi phí thấp)

**Next:** Đợi xác nhận để append BACKLOG. Sau đó Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router), có thể dùng `/docs/json` để auto-gen types.

---

## 2026-05-26 — Backend Phase 1 hoàn thành

**Done:**
- Auth flow đầy đủ (register/login/refresh/me/logout) + JWT type-aware
- Users module (GET /:username, PATCH /me)
- Prisma migration init, model User
- Middleware: auth/validate/asyncHandler/error
- Swagger UI tại /docs (dev-only), OpenAPI 3.1 spec
- 9/9 verify pass (xem PR/commit)

**Lưu ý kỹ thuật phát sinh:**
- Pin zod-to-openapi ^7.3.0 (v8 yêu cầu Zod 4, không tương thích Zod 3.23)
- Circular import lib/openapi ↔ modules/*/openapi → giải bằng lazy require trong registerAll()
- Schema User extract về lib/openapi.ts (dùng chung 2 module)

**Tech debt nhỏ:** Xem `BACKLOG.md` — JWT error message gộp chung mọi case fail.

**Next:** Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router)

---