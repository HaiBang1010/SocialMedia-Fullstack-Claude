# Beng — Social Media Platform

*Moments worth keeping.*

Instagram-like social network — feed, stories, messaging, calls. Build to learn full-stack.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT (access + refresh tokens) |
| API docs | Swagger UI + OpenAPI 3.1 (schema-first từ Zod) |
| Storage | S3-compatible (MinIO local) — presigned upload |
| Real-time (sau này) | Socket.io + Redis |
| Calls (sau này) | WebRTC + simple-peer + TURN server |

## Cấu trúc dự án

```
social-media/
├── README.md                   ← bạn đang đọc
├── ARCHITECTURE.md             ← thiết kế tổng thể (data model, API, technical decisions)
├── PROGRESS.md                 ← log work session (cập nhật mỗi lần code)
├── BACKLOG.md                  ← tech debt + ideas chưa làm
├── CLAUDE.md                   ← project memory cho Claude Code
├── WORKING_WITH_CLAUDE.md      ← guide dùng Claude Code hiệu quả
├── .claude/
│   └── settings.json           ← permissions cho Claude Code
├── .claudeignore               ← file Claude Code không đọc
├── .gitignore
│
├── backend/                    ← Express API (Phase 2 backend ĐÃ XONG)
│   ├── CLAUDE.md
│   ├── README.md               ← setup chi tiết từng bước
│   ├── docker-compose.yml
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── server.ts
│       ├── config/
│       ├── lib/
│       ├── middleware/
│       └── modules/
│
└── frontend/                   ← React app (Phase 1C xong — auth UI + design system + layout)
    ├── CLAUDE.md
    └── README.md
```

## Bắt đầu nhanh

**Yêu cầu trước:** Node.js 20+, Docker Desktop, code editor.

### Backend (đã có code)

```bash
cd backend
npm install
cp .env.example .env       # đổi 2 JWT_SECRET trong file này
docker compose up -d        # khởi Postgres + MinIO
npx prisma migrate dev      # apply migration
npm run dev                 # → http://localhost:3000
                            # → http://localhost:3000/docs (Swagger UI)
```

### Frontend (Phase 1C xong)

```bash
cd frontend
npm install
npm run dev                 # → http://localhost:5173
                            # cần backend chạy :3000 cùng lúc
```

Đọc `backend/README.md` để setup chi tiết từng bước, đặc biệt nếu bạn mới với full-stack.

## Trạng thái build

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 1 | Backend auth + folder structure (+ Swagger) | ✅ Xong |
| 1A | Frontend foundation (Vite 5, React 18, axios, Zustand, router, Tailwind v4) | ✅ Xong |
| 1B | Frontend UI auth (login/register form, profile) | ✅ Xong |
| 1C | Design system "Beng" + layout shell + dark mode | ✅ Xong |
| 2 (BE) | Posts core backend: posts CRUD, MinIO upload, follow, like, comment phẳng, feed API | ✅ Xong |
| 2 (FE) | Posts core frontend: feed page, post card, create post, profile grid, like/comment/follow UI | ⏳ |
| 3 | Posts nâng cao (carousel, video, reply, sticker) | ⏳ |
| 4 | Stories (24h expire, archive, overlays) | ⏳ |
| 5 | Messaging (1-1, group, reactions, recall, share post) | ⏳ |
| 6 | Calls (audio, video, WebRTC) | ⏳ |
| 7 | Polish (notifications, search, hide bài) | ⏳ |

Chi tiết từng phase: xem `ARCHITECTURE.md`. Tiến độ chi tiết: xem `PROGRESS.md`.

## API Endpoints hiện có (Phase 2 backend)

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/health` | - | health check |
| GET | `/docs` · `/docs/json` | - | Swagger UI + OpenAPI 3.1 spec (dev only) |
| POST | `/auth/register` · `/login` · `/refresh` | - | đăng ký / đăng nhập / refresh token |
| GET | `/auth/me` | ✓ | user hiện tại |
| GET | `/users/:username` | - | profile public |
| PATCH | `/users/me` | ✓ | sửa profile |
| GET | `/users/:username/posts` | optional | list post của user (cursor) |
| POST · DELETE | `/users/:username/follow` | ✓ | follow / unfollow (idempotent) |
| GET | `/users/:username/followers` · `/following` | optional | danh sách social (cursor) |
| POST | `/media/presign` | ✓ | xin presigned URL upload (MinIO) |
| POST | `/posts` | ✓ | tạo post (ảnh và/hoặc caption) |
| GET | `/posts/:id` | optional | xem 1 post (visibility follow-aware) |
| PATCH · DELETE | `/posts/:id` | ✓ | sửa / xóa post (owner) |
| POST · DELETE | `/posts/:id/like` | ✓ | like / unlike (idempotent) |
| POST | `/posts/:id/comments` | ✓ | thêm comment |
| GET | `/posts/:id/comments` | optional | list comment (cursor) |
| PATCH · DELETE | `/comments/:id` | ✓ | sửa / xóa comment (author / post owner) |
| GET | `/feed` | ✓ | feed cá nhân hóa (following, 14 ngày, cursor) |

> Mọi response trả post (single / list / feed) kèm `likesCount`, `commentsCount`, `isLikedByMe`, `isFollowingAuthor`. Chi tiết: `backend/CLAUDE.md` + Swagger `/docs`.

## Quy ước project

- **TypeScript end-to-end** — type safety từ DB qua API tới UI
- **Modules theo feature** — mỗi feature 1 folder (auth/, posts/, ...) thay vì layer (controllers/services/)
- **Routes mỏng, services dày** — logic nghiệp vụ trong service, route chỉ điều phối
- **Validation 2 lớp** — Zod ở API + Prisma ở DB
- **Schema-first** — Zod là single source of truth cho cả validation và OpenAPI doc
- **Không commit secrets** — `.env` luôn trong `.gitignore`
- **Migrations versioned** — mọi thay đổi schema qua `prisma migrate`, không sửa DB tay

## Workflow với Claude Code

Project này thiết kế để dùng tốt với Claude Code:

- `CLAUDE.md` ở root và mỗi subfolder = rules cố định Claude tự đọc
- `.claude/settings.json` = permissions cho phép/cấm các bash commands
- `.claudeignore` = file Claude không đọc (node_modules, .env, migrations cũ)
- `PROGRESS.md` = log work session, paste vào prompt khi cần context

Đọc `WORKING_WITH_CLAUDE.md` để hiểu cách dùng hiệu quả.

## License

Personal learning project. Không có license cụ thể.

## Scope discipline

- Khi task thuộc 1 phía (frontend/backend) mà phát hiện cần sửa phía kia → 
  DỪNG, báo user, hỏi trước khi sửa. KHÔNG tự ý mở rộng scope dù lý do hợp lý.
- Ngoại lệ: sửa lỗi typo/comment nhỏ thì OK, nhưng đổi logic/message hàng loạt phải hỏi.
