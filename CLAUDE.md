# Social Media — Project Memory for Claude Code

> File này Claude Code tự đọc ở đầu mỗi session. Chứa rules CỐ ĐỊNH của project.
> Khi bạn đọc file này → bạn đang làm việc trong dự án social media.

## Project identity

App name: Beng

Instagram-like social media platform, mục đích học full-stack. Solo dev. Phase 1 xong (backend auth + frontend foundation/auth UI/design system). Phase 2 xong (BACKEND: posts/media/follow/like/comment + feed API; FRONTEND: 2.4a/b/c posts UI + 2.5 follow/profile/public profile). **Phase 3 xong** (3.1 carousel ≤5 ảnh + 3.2 video upload/playback + delete/visibility/private + 3.3 nested comments/replies). **Phase 4 Stories ✅ COMPLETE** (4.1 Core + 4.2 viewer nâng cao + 4.3a overlays TEXT/EMOJI + 4.4 archive/cron/profile-ring/view-count/viewers). 4.3b (MENTION/STICKER/TAG + multi-touch scale/rotate) + AudioTrack **defer → BACKLOG**. **Phase 5.1 Messaging Foundation ✅ DONE** (Conversation/Participant/Message models + REST direct/group/list/get/messages + responsive list+detail UI + optimistic send + polling 5s + burst grouping; KHÔNG Socket.io [defer 5.2] / media [defer 5.4]). **Phase 5.2 Messaging Realtime ✅ DONE** (Socket.io: JWT handshake + user/convo rooms + `message:new` broadcast [send VẪN REST] + typing + presence [online + last-seen, contact-scoped] + read receipts; polling 5s đã gỡ; chỉ thêm `User.lastSeenAt`). **Phase 5.3a Reactions ✅ DONE** (model `MessageReaction` + POST/DELETE `/messages/:id/reactions` [whitelist 7 emoji, upsert/replace] + socket `message:reaction` delta [user rooms] + FE long-press/hover Popover picker + aggregate chips + optimistic). **Phase 5.3b/5.3c ✅ DONE** (GROUP "Seen by N"/"Seen by all" read-receipt UI [FE-only, positional] + GROUP composite triangle avatar + group min-2-others). **Phase 5.4a Media Messages ✅ DONE** (model `MessageMedia` [Rich: objectKey/thumbnailObjectKey/width/height/order] + `sendMessage` derive contentType + `media[]` 1–10 ảnh+video **trộn được** + caption optional; presign reuse y nguyên; FE client-resize thumbnail + parallel pool-3 upload + IG-adaptive grid + fullscreen lightbox swipe + optimistic per-item progress + retry-resume). **Phase 5.4b Voice Messages ✅ DONE** (`MediaType` +VOICE + presign `audio/webm` 5MB + FE `MediaRecorder` WebM/Opus tap-to-toggle + duration wall-clock + HYBRID 30-bar deterministic player + VOICE exclusive/derive; reuse 5.4a optimistic/upload 100%; Safari `audio/mp4` → BACKLOG). **Phase 5.4c Emoji + Sticker + GIF + Post Share ✅ DONE → Phase 5.4 media COMPLETE** (1 picker 3 tab Emoji|Stickers|GIFs [emoji-mart reuse 4.3a + Giphy backend proxy `/giphy/search|trending`, `GIPHY_API_KEY` server-side]; **EMOJI standalone = content-derived** `isEmojiOnly` jumbomoji KHÔNG media/migration; **STICKER/GIF** = `MediaType` +2 + `objectKey` nullable [Giphy-hosted] reuse media pipeline 0-PUT; **Post share** = `Message.sharedPost` FK `SetNull` + SharePostModal single-select + gate `getViewablePost`; OpenAPI **33→35**. +3 follow-up fix: scroll auto-stick-bottom + floating scroll-to-bottom button; POST_SHARE realtime Seen [`useSharePost` invalidate `conversation(id)`]; emoji-mart full-width scoped CSS). **Phase 5.5 ✅ DONE → Phase 5 COMPLETE** (Recall message [soft-delete tombstone serialize, sender-only ≤15 phút → 410, `DELETE /messages/:id`, socket `message:deleted`, S3 best-effort soft-fail cleanup, reactions cleared; `listMessages` bỏ filter `deletedAt` (tombstone visible) + `conversationInclude.messages` giữ filter (preview skip-to-previous); UI label "Delete", placeholder "Message deleted"] + Group create UI [`GET /users/groupable` = recent partners + mutual followers merge; multi-select modal max 9 others; group name optional → backend auto-derive "Group with X, Y, Z"]; `lib/s3.deleteObject` helper; OpenAPI 35→37; **KHÔNG migration** [`deletedAt` đã có từ 5.1]. **reply-to + group member management UI → BACKLOG**). **Phase 6 Calls ✅ COMPLETE** (Audio+Video 1-1 + group qua **LiveKit Cloud** SFU; migration `add_calls` [Call model, `CallType`/`CallEndReason`, `MessageContentType +CALL`, `Message.callId` FK SetNull]; **Call-as-Message** reuse 5.4c sharedPost infra [pagination/preview/realtime/optimistic free]; BE `lib/livekit.ts` [dynamic ESM import — token mint + room create maxParticipants 50 + listParticipants] + module `calls/` 4 REST [`/calls/start|:id/token|:id/decline|:id/end`] + 3 socket events minimal [`call:incoming/declined/ended`, LiveKit lo signaling, KHÔNG offer/answer/ice]; FE callStore + features/calls hooks + components/calls [IncomingCallDialog ringtone + InCallView LiveKitRoom GridLayout + CallControls dynamic End + CallEntry]; webhook DEFER [missed = FE 30s timeout]; OpenAPI 37→41; env +LIVEKIT_*. +Browser-verify follow-up fixes: ghost-call stale-lock 15s + pagehide keepalive cleanup + duration-inferred endedReason; group End-for-all `deleteRoom` force-kick + last-participant auto-end; active-call "Join" banner cho non-participant; 409 CallInProgress → JoinDialog; block-react trên CALL; CallEntry display-only. `ringtone.mp3` optional [graceful visual-only fallback nếu thiếu]; webhook + screen-share → BACKLOG. **Phase 7 Polish ✅ COMPLETE → project 7/7 hoàn thành** (in-app notifications LIKE/COMMENT/FOLLOW [model `Notification` + 1h dedupe + self-skip + `safeNotify` best-effort trigger ở likes/comments/follows qua `create`+catch-P2002; socket `notification:new`] + unread badges [`GET /conversations` per-item `unreadCount` + `/conversations/unread-total`, `$queryRaw` `COUNT(*)::int` + `COALESCE('-infinity')`; FE local-decrement race-free + `activeConversationStore` mute] + Postgres full-text search [GENERATED tsvector + GIN, `Unsupported("tsvector")?` chống drift, prefix `to_tsquery` `token:*` injection-safe, visibility filter in-SQL; `GET /search`] + default avatar [DiceBear `9.x/toon-head` ở register + backfill smart preserve-custom] + sound/browser notif [message→sound, notification→badge-only, OS notif khi tab hidden]; OpenAPI 41→47. **OUT/defer**: hide bài, block users, MENTION/STORY_VIEW notif, push Service-Worker, notification settings).

## Cấu trúc

```
social-media/
├── frontend/      ← React + Vite (Phase 1–6 FE xong: posts/carousel/video/comments + stories + messaging realtime + media/voice/emoji/sticker/GIF + post share + recall + group create + audio/video calls qua LiveKit)
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
| 5.2 Messaging Realtime (Socket.io infra + JWT handshake + user/convo rooms + message:new broadcast [send REST] + typing + presence [online + last-seen] + read receipts; polling gỡ; + User.lastSeenAt) | ✅ Xong |
| 5.3a Messaging Reactions (MessageReaction model + POST/DELETE reactions whitelist 7 emoji + socket message:reaction delta + FE picker/chips/optimistic) | ✅ Xong |
| 5.3b/5.3c Messaging GROUP read receipts UI ("Seen by N") + GROUP composite avatar (FE) + group min-2 | ✅ Xong |
| 5.4a Messaging Media (Image+Video; MessageMedia model + sendMessage media[]≤10 mix + presign reuse + IG grid + lightbox + optimistic per-item progress/retry) | ✅ Xong |
| 5.4b Messaging Voice messages (MediaType +VOICE + presign audio/webm + MediaRecorder WebM/Opus + HYBRID 30-bar player + tap-to-toggle record + optimistic reuse 5.4a) | ✅ Xong |
| 5.4c Messaging Emoji (jumbomoji) + Sticker + GIF (Giphy proxy) + Post share (unified 3-tab picker; EMOJI content-derived; MediaType +STICKER/GIF; Message.sharedPost FK SetNull; +giphy module, OpenAPI 33→35) | ✅ Xong → **Phase 5.4 media hoàn thành** |
| 5.5 Messaging recall (soft-delete tombstone, sender ≤15min → 410, S3 soft-fail cleanup, socket `message:deleted`) + Group create UI (`GET /users/groupable` recent+mutual merge, multi-select modal, name auto-derive); reply-to + group member management → BACKLOG | ✅ Xong → **Phase 5 hoàn thành** |
| 6. Calls (Audio+Video 1-1 + group, LiveKit Cloud SFU; Call-as-Message; 4 REST + 3 socket events; webhook defer) | ✅ Xong (browser-verified + follow-up fixes; `ringtone.mp3` optional — graceful fallback; webhook/screen-share → BACKLOG) |
| 7. Polish — Notifications (LIKE/COMMENT/FOLLOW + 1h dedupe + socket `notification:new`) + unread badges (per-conv + total, `$queryRaw`) + Postgres full-text search (tsvector + GIN, prefix `to_tsquery`) + default avatar (DiceBear toon-head + backfill) + sound/browser-notif; OpenAPI 41→47 | ✅ Xong → **project 7/7 COMPLETE** (hide bài/block/MENTION+STORY_VIEW notif/push/settings → BACKLOG) |

Project đã hoàn thành 7/7 phase. Task mới ngoài scope đã làm — hỏi user trước khi mở rộng.

## Ngữ cảnh sâu hơn

- `README.md` — overview cho người
- `ARCHITECTURE.md` — thiết kế tổng thể, data model đầy đủ, build order
- `WORKING_WITH_CLAUDE.md` — guide riêng cho user, KHÔNG phải instructions cho Claude
- `backend/CLAUDE.md` / `frontend/CLAUDE.md` — rules cụ thể từng phía

Khi user hỏi "cấu trúc thế nào" — đọc ARCHITECTURE.md trước khi trả lời.
