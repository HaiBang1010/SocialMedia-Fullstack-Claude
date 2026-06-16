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
| Real-time | Socket.io (active từ Phase 5.2 — message:new, typing, presence, read receipts) |
| Sticker / GIF | Giphy API qua backend proxy (Phase 5.4c) |
| Calls | LiveKit Cloud — SFU (managed signaling + TURN, Krisp noise-cancel); `@livekit/components-react` + `livekit-client` (Phase 6) |
| Notifications / Search | In-app notifications (LIKE/COMMENT/FOLLOW) + browser Notification API + sound; Postgres full-text search (ts_vector + GIN); default avatar DiceBear toon-head (Phase 7) |

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
├── backend/                    ← Express API (Phase 1–7 backend ĐÃ XONG — + stories, messaging realtime, media/voice/sticker/GIF, giphy proxy, recall + group create, calls qua LiveKit Cloud, notifications + full-text search + default avatar)
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
└── frontend/                   ← React app (Phase 1–7 FE xong — posts/carousel/video/comments + stories + messaging realtime + media/voice/sticker/GIF/emoji + post share + recall + group create + audio/video calls qua LiveKit + notifications page/badges + search page + sound/browser notif)
    ├── CLAUDE.md
    └── README.md
```

## Bắt đầu nhanh

**Yêu cầu trước:** Node.js 20+, Docker Desktop, code editor.

### Backend (đã có code)

```bash
cd backend
npm install
cp .env.example .env       # đổi 2 JWT_SECRET + GIPHY_API_KEY (5.4c) + LIVEKIT_URL/_API_KEY/_API_SECRET (calls, Phase 6)
                           # Phase 7 KHÔNG cần env mới (default avatar = DiceBear URL hardcode)
docker compose up -d        # khởi Postgres + MinIO
npx prisma migrate dev      # apply migration
npm run dev                 # → http://localhost:3000
                            # → http://localhost:3000/docs (Swagger UI)
```

### Frontend (Phase 1–6 FE xong)

```bash
cd frontend
npm install
npm run dev                 # → http://localhost:5173
                            # cần backend chạy :3000 cùng lúc
```

> Calls (Phase 6) cần LiveKit Cloud project (free tier) — set `LIVEKIT_*` trong `backend/.env`. Sound assets tùy chọn ở `frontend/public/sounds/`: `ringtone.mp3` (incoming call) + `notification.mp3` (message arrive, Phase 7) — CC0; thiếu thì chạy visual-only (badge + browser notification vẫn hoạt động).

Đọc `backend/README.md` để setup chi tiết từng bước, đặc biệt nếu bạn mới với full-stack.

## Trạng thái build

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 1 | Backend auth + folder structure (+ Swagger) | ✅ Xong |
| 1A | Frontend foundation (Vite 5, React 18, axios, Zustand, router, Tailwind v4) | ✅ Xong |
| 1B | Frontend UI auth (login/register form, profile) | ✅ Xong |
| 1C | Design system "Beng" + layout shell + dark mode | ✅ Xong |
| 2 (BE) | Posts core backend: posts CRUD, MinIO upload, follow, like, comment phẳng, feed API | ✅ Xong |
| 2 (FE) | Posts core frontend: feed, post card, create post, profile grid, like/comment, follow button + profile counts, public profile `/users/:username` | ✅ Xong |
| 3 | Posts nâng cao: carousel ≤5 ảnh (3.1) + video upload/playback + delete/visibility/private (3.2) + nested comments/replies + @mention (3.3) — sticker/gif defer | ✅ Xong |
| 4 | Stories: 24h expire, viewer + gestures, text/emoji overlays, archive + cron, profile ring, view count/viewers | ✅ Xong |
| 5.1–5.4 | Messaging: 1-1 + group, Socket.io realtime (typing/presence/read receipts), reactions, media (image/video) + voice, emoji/sticker/GIF (Giphy), post share | ✅ Xong |
| 5.5 | Messaging: recall (soft-delete tombstone, 15-phút window) + group create UI (recent + mutual followers); reply-to + group member management → backlog | ✅ Xong |
| 6 | Calls: audio + video, 1-1 + group, qua LiveKit Cloud (SFU). Call-as-Message trong thread + 4 REST + 3 socket events (call:incoming/declined/ended); webhook + screen-share → backlog | ✅ Xong |
| 7 | Notifications (LIKE/COMMENT/FOLLOW) + unread badges + browser notif + sound + Postgres full-text search + default avatar (DiceBear toon-head); hide bài / block / push → backlog | ✅ Xong → **project 7/7 hoàn thành** |

Chi tiết từng phase: xem `ARCHITECTURE.md`. Tiến độ chi tiết: xem `PROGRESS.md`.

## API Endpoints (core — Phase 1–3 backend)

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/health` | - | health check |
| GET | `/docs` · `/docs/json` | - | Swagger UI + OpenAPI 3.1 spec (dev only) |
| POST | `/auth/register` · `/login` · `/refresh` | - | đăng ký / đăng nhập / refresh token |
| GET | `/auth/me` | ✓ | user hiện tại |
| GET | `/users/:username` | optional | profile public + counts (posts/followers/following) + isFollowing |
| PATCH | `/users/me` | ✓ | sửa profile |
| GET | `/users/:username/posts` | optional | list post của user (cursor) |
| POST · DELETE | `/users/:username/follow` | ✓ | follow / unfollow (idempotent) |
| GET | `/users/:username/followers` · `/following` | optional | danh sách social (cursor) |
| POST | `/media/presign` | ✓ | xin presigned URL upload (MinIO) |
| POST | `/posts` | ✓ | tạo post (≤5 ảnh carousel hoặc 1 video, và/hoặc caption) |
| GET | `/posts/:id` | optional | xem 1 post (visibility follow-aware) |
| PATCH · DELETE | `/posts/:id` | ✓ | sửa / xóa post (owner) |
| POST · DELETE | `/posts/:id/like` | ✓ | like / unlike (idempotent) |
| POST | `/posts/:id/comments` | ✓ | thêm comment hoặc reply (`parentId` optional, flatten về root) |
| GET | `/posts/:id/comments` | optional | list **ROOT** comment + `repliesCount` (cursor) |
| GET | `/comments/:id/replies` | optional | list replies của 1 comment (chronological, cursor) |
| PATCH · DELETE | `/comments/:id` | ✓ | sửa / xóa comment (chỉ comment author) |
| GET | `/feed` | ✓ | feed cá nhân hóa (following, 14 ngày, cursor) |

> Mọi response trả post (single / list / feed) kèm `likesCount`, `commentsCount`, `isLikedByMe`, `isFollowingAuthor`. Chi tiết: `backend/CLAUDE.md` + Swagger `/docs`.

**Stories / Messaging / Giphy / Calls / Notifications / Search** (Phase 4–7) — danh sách đầy đủ trong `backend/CLAUDE.md` + Swagger `/docs` (47 path keys):
- **Stories**: `POST/GET /stories`, `GET /stories/feed`, `POST /stories/:id/view`, `GET /stories/:id/views`, `GET /stories/archive`, `GET /users/:username/stories`, `DELETE /stories/:id`
- **Conversations & Messages**: `POST /conversations/direct|/group`, `GET /conversations[/:id]`, `GET/POST /conversations/:id/messages`, `POST/DELETE /messages/:id/reactions`, `DELETE /messages/:id` (recall, 5.5), `GET /users/groupable` (group create, 5.5)
- **Giphy proxy**: `GET /giphy/search`, `GET /giphy/trending` (sticker + GIF, key server-side)
- **Calls** (Phase 6): `POST /calls/start`, `POST /calls/:id/token` (join), `POST /calls/:id/decline`, `POST /calls/:id/end` — LiveKit token mint + lifecycle; call entries hiện trong thread như CALL message
- **Notifications** (Phase 7): `GET /notifications` (cursor), `GET /notifications/unread-count`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read` — LIKE/COMMENT/FOLLOW, 1h dedupe, `notification:new` socket
- **Search** (Phase 7): `GET /search?q=&type=posts|users|all` — Postgres full-text (prefix `to_tsquery` + GIN, ts_rank); + `GET /conversations/unread-total` (nav badge unread tổng)

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
