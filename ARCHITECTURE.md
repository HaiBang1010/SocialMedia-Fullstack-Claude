# Social Media Platform — Architecture & Build Plan

> Blueprint cho Instagram-like platform: posts, stories, messaging, calls.
> Stack: React + Express + PostgreSQL + Socket.io + WebRTC.

---

## 1. Tech Stack (final)

### Frontend
| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 + Vite | Fast dev, ecosystem |
| Language | TypeScript | Type safety end-to-end |
| Styling | Tailwind CSS v4 (CSS-first) + Shadcn/ui | Theme trong `src/index.css` qua `@theme` (KHÔNG `tailwind.config.js`); tokens oklch warm-neutral + coral "Beng" |
| Fonts | Bricolage Grotesque (heading) + Plus Jakarta Sans (body) | Google Fonts; brand display + UI body |
| UI state | Zustand | Nhẹ hơn Redux, đủ cho UI/auth/calls |
| Server state | TanStack Query | Cache, refetch, optimistic updates miễn phí |
| Routing | React Router v6 | Tiêu chuẩn |
| HTTP client | Axios | Có interceptor cho JWT auto-refresh |
| Forms | react-hook-form + zod | Validation share schema với backend |
| Real-time | socket.io-client | Cùng version với backend |
| WebRTC | simple-peer | Abstract WebRTC API |

### Backend
| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Hợp với TypeScript ecosystem |
| Framework | Express 4 | Tài liệu nhiều, dễ học cho người mới full-stack |
| Language | TypeScript strict | Bắt buộc cho project size này |
| ORM | Prisma 5 | Type-safe, migration tốt, DX xuất sắc |
| Database | PostgreSQL 16 | Relational data + JSON fields khi cần |
| Cache + Pub/Sub | Redis (sau này) | Sessions, rate limit, Socket.io adapter |
| Real-time | Socket.io (sau này) | Rooms, namespaces, fallback transports |
| Auth | JWT raw (jsonwebtoken) | Stateless, mobile-friendly, không cần Passport |
| API Docs | Swagger UI + zod-to-openapi | Schema-first, 1 nguồn truth |
| Storage | S3-compatible | MinIO local (active từ Phase 2), R2/S3 prod |
| Validation | Zod | Share schema với frontend |

### DevOps (sau này)
- Docker Compose cho dev local (postgres + redis + minio + backend)
- Nginx reverse proxy cho prod
- Coturn cho WebRTC TURN server

---

## 2. Folder Structure

### Frontend
```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                  # Tailwind v4 @theme + tokens (warm-neutral/coral "Beng") + .dark
│   ├── api/                       # client.ts (axios interceptor), auth.ts, users.ts, ...
│   ├── components/
│   │   ├── ui/                    # shadcn: Button, Input, Card, Form, Label
│   │   ├── layout/                # AppLayout, Sidebar, RightRail, BottomNav, AuthLayout
│   │   ├── ThemeToggle.tsx
│   │   ├── ProtectedRoute.tsx, PublicOnlyRoute.tsx
│   │   ├── post/  story/  chat/  profile/   # (Phase 2+)
│   ├── features/                  # business logic theo feature
│   ├── hooks/                     # useThemeEffect.ts (+ useSocket, useMediaUpload sau)
│   ├── stores/                    # authStore.ts, themeStore.ts
│   ├── lib/                       # utils.ts (cn), apiError.ts, validations/ (+ socket.ts, peer.ts sau)
│   ├── pages/                     # LoginPage, RegisterPage, HomePage, ProfilePage
│   └── types/                     # api.ts
├── index.html                     # FOUC theme script (set .dark trước khi React mount)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Backend (Phase 1 đã build)
```
backend/
├── src/
│   ├── server.ts                  # Express entry
│   ├── config/
│   │   └── env.ts                 # validated với Zod
│   ├── modules/                   # FEATURE-based
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.schema.ts
│   │   │   └── auth.openapi.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.schema.ts
│   │   │   └── users.openapi.ts
│   │   ├── posts/                 # (Phase 2)
│   │   ├── comments/              # (Phase 2-3)
│   │   ├── stories/               # (Phase 4)
│   │   ├── messages/              # (Phase 5)
│   │   ├── conversations/         # (Phase 5)
│   │   ├── calls/                 # (Phase 6)
│   │   ├── notifications/         # (Phase 7)
│   │   ├── media/                 # (Phase 2)
│   │   └── feed/                  # (Phase 2)
│   ├── socket/                    # (Phase 5+)
│   ├── middleware/
│   │   ├── auth.ts                # requireAuth (verify JWT)
│   │   ├── validate.ts            # Zod validation
│   │   ├── asyncHandler.ts
│   │   └── error.ts               # error handler + AppError
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   ├── openapi.ts             # registry + builder
│   │   └── health.openapi.ts
│   └── jobs/                      # (Phase 4+)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.yml
├── .env.example
├── tsconfig.json
└── package.json
```

Nguyên tắc: backend tổ chức theo **module/feature**, không theo layer.

---

## 3. Database Schema (Prisma)

Phase 1 đã có `User`. Schema đầy đủ sẽ extend dần theo phases:

```prisma
model User {
  id            String   @id @default(cuid())
  username      String   @unique
  email         String   @unique
  passwordHash  String
  name          String
  bio           String?  @db.VarChar(160)
  avatarUrl     String?
  isPrivate     Boolean  @default(false)
  createdAt     DateTime @default(now())

  // Relations (thêm dần theo phase)
  posts         Post[]
  comments      Comment[]
  likes         Like[]
  stories       Story[]
  followers     Follow[] @relation("following")
  following     Follow[] @relation("follower")
  sentMessages  Message[]
  conversations Participant[]
  notifications Notification[]
}

model Follow {                    // Phase 2
  followerId   String
  followingId  String
  createdAt    DateTime @default(now())
  follower     User @relation("follower", fields: [followerId], references: [id])
  following    User @relation("following", fields: [followingId], references: [id])
  @@id([followerId, followingId])
}

model Post {                      // Phase 2
  id           String   @id @default(cuid())
  authorId     String
  caption      String?  @db.Text
  audioTrackId String?
  visibility   PostVisibility @default(PUBLIC)
  createdAt    DateTime @default(now())

  author       User @relation(fields: [authorId], references: [id])
  media        PostMedia[]
  comments     Comment[]
  likes        Like[]
  audioTrack   AudioTrack? @relation(fields: [audioTrackId], references: [id])

  @@index([authorId, createdAt])
}

enum PostVisibility { PUBLIC FOLLOWERS PRIVATE }

model PostMedia {                 // Phase 2
  id           String   @id @default(cuid())
  postId       String
  type         MediaType
  url          String
  thumbnailUrl String?
  duration     Int?
  order        Int
  width        Int?
  height       Int?
  post         Post @relation(fields: [postId], references: [id], onDelete: Cascade)
}

enum MediaType { IMAGE VIDEO }

model Comment {                   // Phase 2-3
  id          String   @id @default(cuid())
  postId      String
  authorId    String
  parentId    String?              // recursive — UI flatten 1 cấp
  contentType CommentContentType
  content     String   @db.Text
  createdAt   DateTime @default(now())

  post        Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  author      User @relation(fields: [authorId], references: [id])
  parent      Comment? @relation("replies", fields: [parentId], references: [id])
  replies     Comment[] @relation("replies")

  @@index([postId, createdAt])
}

enum CommentContentType { TEXT IMAGE STICKER GIF }

model Like {                      // Phase 2
  userId    String
  postId    String
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
  post      Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([userId, postId])
}

model Story {                     // Phase 4
  id           String   @id @default(cuid())
  authorId     String
  mediaUrl     String
  mediaType    MediaType
  audioTrackId String?
  expiresAt    DateTime
  isArchived   Boolean  @default(false)
  createdAt    DateTime @default(now())

  author       User @relation(fields: [authorId], references: [id])
  items        StoryItem[]
  views        StoryView[]
  audioTrack   AudioTrack? @relation(fields: [audioTrackId], references: [id])

  @@index([authorId, expiresAt])
  @@index([isArchived, expiresAt])
}

model StoryItem {                 // Phase 4 — overlays
  id        String   @id @default(cuid())
  storyId   String
  type      StoryItemType
  x         Float                  // 0-1 relative position
  y         Float
  scale     Float    @default(1)
  rotation  Float    @default(0)
  payload   Json                   // { username }, { emoji }, etc.
  story     Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
}

enum StoryItemType { MENTION STICKER EMOJI TAG TEXT }

model StoryView {                 // Phase 4
  storyId  String
  viewerId String
  viewedAt DateTime @default(now())
  story    Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  @@id([storyId, viewerId])
}

model Conversation {              // Phase 5
  id           String   @id @default(cuid())
  type         ConversationType
  name         String?
  avatarUrl    String?
  createdAt    DateTime @default(now())
  participants Participant[]
  messages     Message[]
  calls        Call[]
}

enum ConversationType { DIRECT GROUP }

model Participant {               // Phase 5
  conversationId    String
  userId            String
  joinedAt          DateTime @default(now())
  lastReadMessageId String?
  isAdmin           Boolean  @default(false)
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user              User @relation(fields: [userId], references: [id])
  @@id([conversationId, userId])
}

model Message {                   // Phase 5
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  contentType    MessageContentType
  content        String?  @db.Text
  replyToId      String?
  sharedPostId   String?
  deletedAt      DateTime?
  createdAt      DateTime @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User @relation(fields: [senderId], references: [id])
  media          MessageMedia[]
  reactions      MessageReaction[]
  replyTo        Message? @relation("replies", fields: [replyToId], references: [id])
  replies        Message[] @relation("replies")

  @@index([conversationId, createdAt])
}

enum MessageContentType { TEXT IMAGE VIDEO EMOJI STICKER GIF POST_SHARE VOICE }

model MessageMedia {              // Phase 5
  id           String   @id @default(cuid())
  messageId    String
  type         MediaType
  url          String
  thumbnailUrl String?
  duration     Int?
  message      Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

model MessageReaction {           // Phase 5
  messageId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())
  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  @@id([messageId, userId])
}

model Call {                      // Phase 6
  id             String   @id @default(cuid())
  conversationId String
  initiatorId    String
  type           CallType
  startedAt      DateTime @default(now())
  endedAt        DateTime?
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

enum CallType { AUDIO VIDEO }

model AudioTrack {                // Phase 3-4
  id        String  @id @default(cuid())
  title     String
  artist    String
  url       String
  duration  Int
  posts     Post[]
  stories   Story[]
}

model Notification {              // Phase 7
  id        String   @id @default(cuid())
  userId    String
  type      NotificationType
  actorId   String?
  postId    String?
  commentId String?
  readAt    DateTime?
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
}

enum NotificationType { LIKE COMMENT FOLLOW MENTION MESSAGE STORY_VIEW }
```

> **Phase 4.1 — `Story`/`StoryView` ACTUAL (khác bản plan ở trên):**
> - `Story` lưu **media phẳng trên row** (`mediaUrl`, `mediaObjectKey`, `mediaType`, `thumbnailUrl?`, `thumbnailObjectKey?`, `duration?`, `width?`, `height?`) — 1 story = 1 media, KHÔNG child-table. Thêm `mediaObjectKey`/`thumbnailObjectKey` cho S3 cleanup (parity PostMedia).
> - **KHÔNG cột `visibility`** — privacy ở user-level (private account + non-follower → ẩn). **KHÔNG** `audioTrackId`/`audioTrack`/`items` relation — `StoryItem` + `AudioTrack` defer 4.3/4.4, nên Story 4.1 chỉ có `author` + `views`.
> - `StoryView` thêm **`viewer User @relation`** (FULL FK, KHÁC plan để `viewerId` trơ) + `@@index([viewerId])`; `@@id([storyId, viewerId])` (upsert idempotent). `User` thêm `stories Story[]` + `storyViews StoryView[]`.
> - `expiresAt = now()+24h` (set backend lúc create). Active = `expiresAt > now AND isArchived = false`. Cron flip `isArchived` → Phase 4.4.
>
> **Phase 4.4 addendum:** `StoryView` thêm `@@index([storyId, viewedAt(sort: Desc)])` (backing viewers-list cursor). Cron `archiveExpiredStories` (setInterval 1h, `server.ts`) flip `isArchived`. `Story` response thêm `viewCount` (owner-only, null cho non-owner — feed loại self nên luôn null). `getUserProfile` thêm `hasActiveStory` (drive story ring trên profile avatar). KHÔNG model mới, chỉ 1 index additive.

---

## 4. API Routes

```
# Auth (Phase 1 — DONE)
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
GET    /auth/me                       # auth required
POST   /auth/logout

# Users (Phase 1 — DONE)
GET    /users/:username
PATCH  /users/me                      # auth required

# Posts (Phase 2)
GET    /feed
GET    /posts/:id
POST   /posts
DELETE /posts/:id
PATCH  /posts/:id/visibility
POST   /posts/:id/like
DELETE /posts/:id/like

# Comments (Phase 2-3)
GET    /posts/:id/comments            # Phase 3.3: root only + repliesCount
POST   /posts/:id/comments            # optional parentId (reply, flatten to root)
GET    /comments/:id/replies          # Phase 3.3: lazy-load replies (chronological)
PATCH  /comments/:id                  # edit (comment author)
DELETE /comments/:id                  # Phase 3.3: comment author only

# Follows (Phase 2)
POST   /users/:id/follow
DELETE /users/:id/follow
GET    /users/:id/followers
GET    /users/:id/following

# Stories (Phase 4 — ACTUAL, khác plan ở vài route)
POST   /stories                       # create (image/video + overlay items[])
GET    /stories/feed                  # following users' active stories, grouped
GET    /users/:username/stories       # one user's active stories (KHÔNG GET /stories/:id như plan)
POST   /stories/:id/view              # mark viewed → 204
DELETE /stories/:id                   # owner only → 204
GET    /stories/archive               # 4.4 — own archived (NOT /users/me/... — tránh username="me")
GET    /stories/:id/views             # 4.4 — viewers list (owner only, 403 else)

# Conversations & Messages (Phase 5)
GET    /conversations
POST   /conversations
GET    /conversations/:id/messages
POST   /conversations/:id/messages
DELETE /messages/:id                  # thu hồi (soft delete)
POST   /messages/:id/reactions
DELETE /messages/:id/reactions

# Media upload (Phase 2)
POST   /media/presign

# Calls (Phase 6 — signaling via socket)
GET    /calls/turn-credentials
```

---

## 5. Socket.io Events (Phase 5-6)

```
// Client → Server
'message:send'           { conversationId, content, ... }
'message:typing'         { conversationId }
'message:read'           { conversationId, lastMessageId }

'call:offer'             { to, sdp, type }
'call:answer'            { to, sdp }
'call:ice'               { to, candidate }
'call:end'               { to }

// Server → Client
'message:new'            { message }
'message:deleted'        { messageId }
'message:reaction'       { messageId, reaction }
'message:typing'         { conversationId, userId }
'message:read'           { conversationId, userId, messageId }

'call:incoming'          { from, sdp, type }
'call:answered'          { from, sdp }
'call:ice'               { from, candidate }
'call:ended'             { from }

'notification:new'       { notification }
'presence:update'        { userId, online }
```

---

## 6. Key Technical Decisions

### Feed algorithm (Phase 2)
- Nguồn: posts của các User mà current user đang follow, trong N = 14 ngày gần đây.
- Pagination: cursor = `(createdAt, id)` chronological (stable, không lệch khi có post mới chèn vào). Limit 20/page.
- Shuffle **client-side** sau khi fetch page (KHÔNG `$queryRaw` + `ORDER BY RANDOM()`) → giữ Prisma type-safe, server nhẹ. Trade-off: reload thấy cùng 20 posts nhưng thứ tự khác — acceptable cho Phase 2.
- Edge case: user follow 0 người → trả empty + gợi ý users to follow (RightRail "Suggested for you").
- KHÔNG chronological thuần, KHÔNG AI personalization.
- Phase polish: nếu cần stable order per session → move shuffle sang server-side (lưu seed vào cursor).

### Comments: split endpoints + flatten on create (Phase 3.3 — approach a)
- DB vẫn cho phép `parentId` self-relation, nhưng **flatten 1 cấp lúc create**: nếu reply trỏ tới 1 reply, backend reassign `parentId = parent.parentId` (về root) → chain DB tối đa 1 cấp.
- **Split endpoints (KHÔNG group client-side toàn bộ — bỏ approach b)**:
  - `GET /posts/:id/comments` → chỉ **root** (`parentId IS NULL`), newest-first, kèm `repliesCount`.
  - `GET /comments/:id/replies` → replies của 1 comment, lazy-load, chronological asc.
  - Lý do bỏ approach (b) "nhận tất cả rồi group": cursor pagination làm reply có thể rơi khác trang với cha → group vỡ.
- **Reply UI**: thụt 1 cấp; "Reply" trên reply vẫn attach về root nhưng prefix `@<reply_author>`. @mention parse thành Link tới profile.
- **Delete**: chỉ comment-author (đổi từ author-hoặc-post-author). Cascade xóa replies qua `onDelete: Cascade` (self-relation + post).

### Stories: time-based filter, soft archive
- Tạo: `expiresAt = now() + 24h`.
- Active query: `WHERE expiresAt > NOW() AND isArchived = false`.
- Cron mỗi 5 phút (`src/jobs/archiveExpiredStories.ts`, Phase 4.4): `UPDATE WHERE expiresAt < NOW() SET isArchived = true`.
- Archive: `WHERE authorId = me AND isArchived = true`.

### Messaging: chat without follow
- KHÔNG check follow khi gửi message.
- KIỂM TRA block list (model `Block` thêm sau).
- Conversation đầu tiên với người chưa follow → đánh dấu "request" client-side.

### Recall message
- Soft delete: `deletedAt = NOW()`, KHÔNG xóa hàng.
- Server emit `message:deleted` qua socket.
- Client thay nội dung thành "Tin nhắn đã được thu hồi".

### Video calls (WebRTC)
- Backend chỉ làm **signaling** qua Socket.io — không stream media.
- Stream peer-to-peer.
- TURN server BẮT BUỘC. Self-host Coturn hoặc dùng dịch vụ.
- Frontend dùng `simple-peer`.
- **Group call > 2 người**: P2P mesh không scale. Cân nhắc SFU (mediasoup) hoặc LiveKit. Bỏ khỏi MVP.

### Media upload: presigned URLs
- Client xin presigned URL: `POST /media/presign`.
- Client upload trực tiếp lên S3 → giảm tải backend.
- Sau khi upload xong, client gửi reference URL.
- **Phase 2**: chỉ single image. MIME whitelist `['image/jpeg', 'image/png', 'image/webp']`, max 5MB. Validate cả client (trước khi xin presign) lẫn server (khi cấp presign). Storage = MinIO local (Docker, S3-compatible).
- **Phase 3**: mở rộng video + multi-file (carousel).
- Video lớn → queue transcode (BullMQ) tạo nhiều resolution + thumbnail.

### API documentation: Zod-driven (Phase 1 đã có)
- Zod schemas trong `modules/*/schema.ts` là **single source of truth**.
- `modules/*/openapi.ts` đăng ký Zod vào OpenAPI registry.
- `@asteasolutions/zod-to-openapi` sinh OpenAPI 3.1 spec.
- Swagger UI render spec tại `/docs` (dev-only).
- **KHÔNG viết JSDoc Swagger tay trên routes.**

---

## 7. Build Phases

| Phase | Tuần | Deliverables | Status |
|---|---|---|---|
| 1. Foundation | 1-2 | Auth, user CRUD, profile, Swagger | ✅ Backend done |
| 1A Frontend | 1 | Vite setup, axios, Zustand, router | ✅ Done |
| 1B Frontend | 1 | Login/Register/Home/Profile UI | ✅ Done |
| 1C Frontend | 2 | Design system "Beng" + layout shell + dark mode | ✅ Done |
| 2. Posts core (BE) | 3-5 | Posts CRUD, MinIO upload, follow, like, comment phẳng, feed API | ✅ Backend done |
| 2. Posts core (FE) | 3-5 | Feed page, post card, create post, profile grid, like/comment/follow UI (shuffle client-side) | ✅ Done |
| 3. Posts nâng cao | 6 | Carousel (3.1) + video (3.2) + nested replies & @mention (3.3); sticker/gif → defer | ✅ Done |
| 4.1 Stories Core | 7 | BE module (Story/StoryView + 5 endpoints) + StoryBar data thật + composer slim (9:16 / video ≤15s) + viewer cơ bản | 🟡 Code-complete (chờ migration apply + verify) |
| 4.2 Stories viewer+ | 7 | Progress bars + gestures (hold/swipe) + auto-advance qua users | ✅ Done |
| 4.3a Stories overlays | 8 | StoryItem: TEXT + EMOJI (drag) + video edit | ✅ Done |
| 4.3b Stories overlays | 8 | MENTION/STICKER/TAG + multi-touch scale/rotate | ⏸ Defer (BACKLOG) |
| 4.4 Stories archive | 8 | isArchived cron 5 phút + archive page + profile ring entry + view count/viewers (AudioTrack defer) | ✅ Done → **Phase 4 complete** |
| 5. Messaging | 9-12 | 1-1, group, reactions, recall, share | ⏳ |
| 6. Calls | 13-14 | Audio + video call 1-1 | ⏳ |
| 7. Polish | 15-16 | Notifications, search, hide bài, bảo mật | ⏳ |

---

## 8. Câu hỏi mở (xác định khi tới phase tương ứng)

1. **Mobile app** sau này có làm không?
2. **Notifications push** (web push)? Cần Service Worker + VAPID keys.
3. **Search** — Postgres full-text đủ chưa, hay cần Meilisearch?
4. **OAuth** (Google/Apple)? — Phase polish.
5. **Triển khai** — VPS Docker, hay services tách (Render/Railway/Fly.io)?
6. **Region** — server VN hay global? Ảnh hưởng latency realtime + TURN.

---

*Bản kế hoạch này sẽ điều chỉnh khi gặp realities trong code.*
