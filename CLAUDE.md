# Social Media — Project Memory for Claude Code

> File này Claude Code tự đọc ở đầu mỗi session. Chứa rules CỐ ĐỊNH của project.
> Khi bạn đọc file này → bạn đang làm việc trong dự án social media.

## Project identity

App name: Beng

Instagram-like social media platform, mục đích học full-stack. Solo dev. Phase 1 xong (backend auth + frontend foundation/auth UI/design system). Phase 2 xong (BACKEND: posts/media/follow/like/comment + feed API; FRONTEND: 2.4a/b/c posts UI + 2.5 follow/profile/public profile). **Phase 3 xong** (3.1 carousel ≤5 ảnh + 3.2 video upload/playback + delete/visibility/private + 3.3 nested comments/replies). **Phase 4 Stories ✅ COMPLETE** (4.1 Core + 4.2 viewer nâng cao + 4.3a overlays TEXT/EMOJI + 4.4 archive/cron/profile-ring/view-count/viewers). 4.3b (MENTION/STICKER/TAG + multi-touch scale/rotate) + AudioTrack **defer → BACKLOG**. **Phase 5.1 Messaging Foundation ✅ DONE** (Conversation/Participant/Message models + REST direct/group/list/get/messages + responsive list+detail UI + optimistic send + polling 5s + burst grouping; KHÔNG Socket.io [defer 5.2] / media [defer 5.4]). Tiếp theo: Phase 5.2 Socket.io realtime.

## Cấu trúc

```
social-media/
├── frontend/      ← React + Vite (Phase 1/2/3 FE xong: posts UI + follow + profile + carousel + video + nested comments)
├── backend/       ← Express + Prisma + PostgreSQL
└── docs (README.md, ARCHITECTURE.md, WORKING_WITH_CLAUDE.md)
```

Mỗi sub-folder có CLAUDE.md riêng — đọc khi làm việc trong folder đó.

## Communication

- **Trao đổi tiếng Việt** với user — user nói tiếng Việt
- **Comment code bằng tiếng Anh** 
- **Error messages return cho user tiếng Anh** (HTTP responses, validation errors)
- **UI labels của app** (buttons, nav, menu, placeholder, tooltip, headings): TIẾNG ANH
- **Error messages return cho user** (HTTP responses, validation errors, toast): TIẾNG ANH
- **User-generated content** (caption, bio, comment, post text): user nhập gì giữ nguyên đó

## Tech stack (immutable)

- TypeScript end-to-end, KHÔNG dùng JavaScript thô
- Backend: Node.js 20+, Express, Prisma, PostgreSQL 16, JWT
- Frontend: React 18, Vite, Tailwind, Shadcn/ui, Zustand, TanStack Query
- Package manager: npm (không Yarn/pnpm trừ khi user yêu cầu)

## Cross-cutting rules

### Code organization
- Backend tổ chức theo **feature module** (`modules/auth/`, `modules/posts/`), KHÔNG theo layer (`controllers/`, `services/` ở root)
- Mỗi module có: `*.routes.ts`, `*.service.ts`, `*.schema.ts` (Zod)
- **Routes mỏng** — chỉ điều phối, gọi service, trả response
- **Services dày** — toàn bộ logic nghiệp vụ
- Validation 2 lớp: Zod ở API + Prisma constraints ở DB

### Naming
- Models Prisma: PascalCase singular (`User`, `Post`, KHÔNG `Users`)
- Fields Prisma: camelCase (`createdAt`, KHÔNG `created_at`)
- TypeScript files: kebab-case cho component file (`post-card.tsx`), camelCase cho utility (`formatDate.ts`)
- React components: PascalCase exports

### Git workflow
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
- Commit thẳng vào `main` (solo dev) — KHÔNG bắt buộc feature branch; chỉ tách branch khi user yêu cầu
- KHÔNG bao giờ commit `.env`, `node_modules/`, `dist/`, `prisma/migrations/dev.db*`

### Security / data
- **KHÔNG BAO GIỜ** log/return `passwordHash` ra ngoài service layer
- JWT secrets phải ≥ 32 chars (env validation tự fail nếu sai)
- Mọi user input qua Zod trước khi xuống DB

## Anti-patterns — Claude không được làm

- ❌ `prisma db push` (skip migration history — không an toàn)
- ❌ Sửa file trong `prisma/migrations/<timestamp>_*/` đã tồn tại
- ❌ Lưu password thô ở bất kỳ đâu
- ❌ Sửa file trong `node_modules/` 
- ❌ Tạo `controllers/` folder kiểu MVC truyền thống — dự án dùng module-per-feature
- ❌ Thêm dependencies mới mà chưa hỏi user (đặc biệt với package nhiều người không quen)
- ❌ Đổi tech stack đã chốt (ví dụ: chuyển Prisma sang Drizzle) mà chưa hỏi

## Phase status

| Phase | Status |
|---|---|
| 1. Backend auth + folder structure (+ Swagger) | ✅ Xong |
| 1A. Frontend foundation (Vite/React/Tailwind/axios/Zustand/router) | ✅ Xong |
| 1B. Frontend auth UI (login/register/profile form) | ✅ Xong |
| 1C. Design system "Beng" + layout shell + dark mode | ✅ Xong |
| 2. Posts core — BACKEND (posts CRUD, MinIO upload, follow, like, comment phẳng, feed API) | ✅ Xong |
| 2.4a/b/c (Frontend). Posts UI (data layer, feed, post card, like/comment, composer, profile grid) | ✅ Xong |
| 2.5 (Frontend). Follow button + profile counts + public profile route `/users/:username` | ✅ Xong |
| 3.1 Posts nâng cao. Multi-image carousel (≤5 ảnh) | ✅ Xong |
| 3.2 Posts nâng cao. Video upload + playback (+ delete post, change visibility, private toggle) | ✅ Xong |
| 3.3 Posts nâng cao. Nested comments / replies (split endpoints, flatten 1 cấp, @mention) | ✅ Xong → **Phase 3 hoàn thành** |
| 4.1 Stories Core (BE module + StoryBar data thật + composer slim + viewer cơ bản) | ✅ Xong |
| 4.2 Stories viewer nâng cao (progress bars + gestures + auto-advance qua users) | ✅ Xong |
| 4.3a Stories overlays (TEXT + EMOJI — StoryItem, drag + video edit) | ✅ Xong |
| 4.3b Stories overlays (MENTION/STICKER/TAG + multi-touch scale/rotate) | ⏸ Defer → BACKLOG |
| 4.4 Stories archive + cron (isArchived cron 5 phút + archive page + profile ring entry + view count/viewers list) | ✅ Xong → **Phase 4 hoàn thành** (4.3b + AudioTrack defer) |
| 5.1 Messaging Foundation (Conversation/Message models + REST direct/group/list/get/messages + responsive list+detail UI + optimistic send + polling 5s + burst grouping; KHÔNG Socket.io / media) | ✅ Xong |
| 5.2-5.5 Messaging (Socket.io realtime, typing, read receipts, reactions, media, recall, share, group UI) | Chưa bắt đầu |
| 6-7 | Chưa bắt đầu |

Khi bạn (Claude) thấy task ngoài phase hiện tại — hỏi user có muốn skip ahead không.

## Ngữ cảnh sâu hơn

- `README.md` — overview cho người
- `ARCHITECTURE.md` — thiết kế tổng thể, data model đầy đủ, build order
- `WORKING_WITH_CLAUDE.md` — guide riêng cho user, KHÔNG phải instructions cho Claude
- `backend/CLAUDE.md` / `frontend/CLAUDE.md` — rules cụ thể từng phía

Khi user hỏi "cấu trúc thế nào" — đọc ARCHITECTURE.md trước khi trả lời.
