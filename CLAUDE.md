# Social Media — Project Memory for Claude Code

> File này Claude Code tự đọc ở đầu mỗi session. Chứa rules CỐ ĐỊNH của project.
> Khi bạn đọc file này → bạn đang làm việc trong dự án social media.

## Project identity

App name: Beng

Instagram-like social media platform, mục đích học full-stack. Solo dev. Phase 1 xong (backend auth + frontend foundation/auth UI/design system); kế tiếp Phase 2 (posts).

## Cấu trúc

```
social-media/
├── frontend/      ← React + Vite (Phase 1A/1B/1C xong: foundation + auth UI + design system/layout)
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
- KHÔNG commit thẳng vào `main` — luôn qua feature branch nếu user nói tới Git
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
| 2. Posts core (1 ảnh đơn, feed follow+shuffle, like, follow, comment phẳng, MinIO storage) | Chưa bắt đầu |
| 3-7 | Chưa bắt đầu |

Khi bạn (Claude) thấy task ngoài phase hiện tại — hỏi user có muốn skip ahead không.

## Ngữ cảnh sâu hơn

- `README.md` — overview cho người
- `ARCHITECTURE.md` — thiết kế tổng thể, data model đầy đủ, build order
- `WORKING_WITH_CLAUDE.md` — guide riêng cho user, KHÔNG phải instructions cho Claude
- `backend/CLAUDE.md` / `frontend/CLAUDE.md` — rules cụ thể từng phía

Khi user hỏi "cấu trúc thế nào" — đọc ARCHITECTURE.md trước khi trả lời.
