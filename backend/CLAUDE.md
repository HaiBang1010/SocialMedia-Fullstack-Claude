# Backend — Project Memory

> Auto-loaded khi Claude Code làm việc trong `backend/`. Bổ sung cho root CLAUDE.md.

## Stack chi tiết

- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4 (KHÔNG dùng Fastify dù docs cũ có nhắc)
- **Language**: TypeScript strict mode
- **ORM**: Prisma 5
- **DB**: PostgreSQL 16 chạy qua Docker (`docker-compose.yml`)
- **Auth**: JWT raw (jsonwebtoken), KHÔNG dùng @fastify/jwt hay passport
- **Validation**: Zod
- **Dev runner**: tsx (watch mode)

## Storage

- **Storage**: MinIO local (Docker), S3-compatible API
- **Docker service**: `minio` trong `docker-compose.yml`, creds default `minio` / `minio12345` (DEV ONLY — Phase polish dùng env thật)
- **Endpoint dev**: `http://localhost:9000` (API), `:9001` (console)
- **Bucket**: `social-media-media` (tạo khi setup Phase 2)
- **Access model**: bucket để **public-read** → đọc ảnh qua `S3_PUBLIC_URL` trực tiếp (không sign). **Upload** mới dùng presigned PUT. Private posts (`visibility=PRIVATE`) để Phase polish.
- **Pattern**: presigned URL upload — client upload trực tiếp lên MinIO, backend KHÔNG nhận file body
- **Library** (cài Phase 2): `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`

## Lệnh hay dùng

```bash
npm run dev                          # tsx watch src/server.ts
npm run build && npm start           # production build
npx prisma migrate dev --name <desc> # tạo migration mới
npx prisma studio                    # GUI xem DB ở :5555
npx prisma generate                  # regenerate client (sau khi sửa schema)
docker compose up -d                 # start Postgres
docker compose down -v               # reset Postgres (XÓA HẾT data)
```

## Cấu trúc

```
backend/src/
├── server.ts              ← entry point, đăng ký middleware + routes
├── config/env.ts          ← validate env vars với Zod khi khởi động
├── lib/                   ← utilities (prisma, jwt, password)
├── middleware/            ← Express middleware
│   ├── auth.ts            ← requireAuth (verify JWT)
│   ├── validate.ts        ← Zod request validation
│   ├── asyncHandler.ts    ← wrap async routes để bắt lỗi
│   └── error.ts           ← error handler + AppError class
└── modules/<feature>/
    ├── <feature>.routes.ts    ← Express router
    ├── <feature>.service.ts   ← business logic
    └── <feature>.schema.ts    ← Zod schemas + inferred types
```

## Patterns BẮT BUỘC tuân thủ

### Routes
Mọi route phải dùng `asyncHandler` để bắt lỗi async:
```ts
router.post('/x', validate(xSchema), asyncHandler(async (req, res) => {
  const result = await xService.doSomething(req.body);
  res.json(result);
}));
```

### Services
- Throw `AppError(statusCode, code, message)` cho lỗi nghiệp vụ
- KHÔNG bao giờ đưa `passwordHash` vào response object → dùng `publicUserSelect`
- Trả về plain objects, KHÔNG res/req
- Post serialization: `posts.service.ts` export `postInclude(viewerId?)` (Prisma include động: author/media/_count + likes của viewer) và `serializePost(post, { isFollowingAuthor })` (DTO + 4 social field). Feed reuse 2 helper này — KHÔNG tự build include/DTO riêng cho post.

### Schemas
- Mỗi endpoint = 1 Zod schema named export
- Export inferred types: `export type XInput = z.infer<typeof xSchema>`
- Service nhận input đã typed, không nhận `req.body` raw

### Error handling
- Lỗi unique (`P2002`) → 409 (đã handle ở `middleware/error.ts`)
- Lỗi không xác định → 500 (đã handle)
- KHÔNG try/catch trong routes — để asyncHandler + errorHandler lo

## Prisma rules

- ❌ KHÔNG dùng `prisma db push` — luôn dùng `prisma migrate dev`
- ❌ KHÔNG sửa migration file đã commit
- ✅ Mỗi thay đổi schema → migration mới, đặt tên descriptive (`add_post_audio_track`, không `migration_2`)
- ✅ Sau khi sửa schema → chạy `prisma generate` để TypeScript types được update
- ✅ Khi cần xem data → `prisma studio` thay vì psql query

## Auth flow đã chốt

- Access token: 1h, gửi qua `Authorization: Bearer <token>` header
- Refresh token: 7d, gửi trong response body (Phase 1 đơn giản; Phase polish sẽ chuyển sang httpOnly cookie)
- JWT payload: `{ sub: userId, username, type: 'access' | 'refresh' }`
- Verify type của token — refresh token KHÔNG được dùng làm access

## Endpoints hiện có (Phase 1)

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/health` | - | health check |
| GET | `/docs` | - | Swagger UI (dev only) |
| GET | `/docs/json` | - | OpenAPI 3.1 spec JSON (dev only) |
| POST | `/auth/register` | - | tạo user |
| POST | `/auth/login` | - | login (email hoặc username) |
| POST | `/auth/refresh` | - | xin access token mới |
| GET | `/auth/me` | ✓ | user hiện tại |
| POST | `/auth/logout` | - | placeholder |
| GET | `/users/:username` | optional | profile public + counts (posts/followers/following) + isFollowing |
| GET | `/users/:username/posts` | optional | list post của user (cursor pagination) |
| PATCH | `/users/me` | ✓ | sửa profile |
| POST | `/media/presign` | ✓ | xin presigned URL upload |
| POST | `/posts` | ✓ | tạo post (ảnh và/hoặc caption) |
| GET | `/posts/:id` | optional | xem 1 post (private/followers + non-owner → 404) |
| PATCH | `/posts/:id` | ✓ | sửa caption/visibility (owner) |
| DELETE | `/posts/:id` | ✓ | xóa post + media S3 (owner) |
| POST | `/posts/:id/like` | ✓ | like post (idempotent) |
| DELETE | `/posts/:id/like` | ✓ | unlike post (idempotent) |
| POST | `/posts/:id/comments` | ✓ | thêm comment hoặc reply (`parentId` optional; reply flatten về root) |
| GET | `/posts/:id/comments` | optional | list **ROOT** comment (newest first, cursor, default 10) + `repliesCount` mỗi item |
| GET | `/comments/:id/replies` | optional | list replies của 1 comment (chronological asc, cursor, default 4) |
| PATCH | `/comments/:id` | ✓ | sửa comment (author) |
| DELETE | `/comments/:id` | ✓ | xóa comment (**chỉ comment author** — đổi từ author-hoặc-post-owner ở 2.3b-1) |
| POST | `/users/:username/follow` | ✓ | follow user (idempotent) |
| DELETE | `/users/:username/follow` | ✓ | unfollow user (idempotent) |
| GET | `/users/:username/followers` | optional | list followers (cursor) |
| GET | `/users/:username/following` | optional | list following (cursor) |
| GET | `/feed` | ✓ | personalized feed (following users, 14 ngày, cursor) |
| POST | `/stories` | ✓ | tạo story (1 image hoặc video, expiresAt = now+24h; + overlay `items[]` TEXT/EMOJI 4.3a) |
| GET | `/stories/feed` | ✓ | active stories của following users, grouped by author + `hasUnseenStory` |
| POST | `/stories/:id/view` | ✓ | mark story viewed (upsert idempotent; **self-view skip** — owner xem own story KHÔNG ghi) → 204 |
| DELETE | `/stories/:id` | ✓ | xóa story + S3 cleanup (owner) → 204 |
| GET | `/stories/archive` | ✓ | own archived stories (newest-first, cursor) → `{ stories, nextCursor }` (Phase 4.4) |
| GET | `/stories/:id/views` | ✓ | viewers list (OWNER only → 403 else; cursor, `viewedAt` desc) → `{ viewers, nextCursor }` (Phase 4.4) |
| GET | `/users/:username/stories` | optional | active stories của 1 user (privacy gate, per-story `isViewedByMe`) |
| POST | `/conversations/direct` | ✓ | start/reuse 1-1 conversation (idempotent qua `directKey` upsert; self → 400, target không tồn tại → 404) (Phase 5.1) |
| POST | `/conversations/group` | ✓ | tạo group (creator = admin; dedupe + drop self khỏi `participantIds`, min 1 other → 400) (Phase 5.1) |
| GET | `/conversations` | ✓ | conversations của viewer, `lastMessageAt` desc, cursor → `{ conversations, nextCursor }` (Phase 5.1) |
| GET | `/conversations/:id` | ✓ | 1 conversation (**participant only → 404 nếu không phải, ẩn existence**) (Phase 5.1) |
| GET | `/conversations/:id/messages` | ✓ | messages **newest-first**, cursor (participant → 404 else) → `{ messages, nextCursor }` (Phase 5.1) |
| POST | `/conversations/:id/messages` | ✓ | gửi TEXT message (participant → **403** else; bump `lastMessageAt` + sender `lastReadMessageId`) (Phase 5.1) |

Khi thêm endpoint mới, update bảng trên.

> **PostMedia.objectKey** lưu S3 key (không chỉ URL) để `DeleteObject` khi xóa post — URL không đủ vì public-read URL có thể khác key. Xóa S3 là best-effort: fail thì log, không chặn DB delete.
> **Carousel (Phase 3.1)**: `POST /posts` nhận `media[]` tối đa **5** (`createPostSchema.media.max(5)`). `createPost` đã `map((m, index) => ({...m, order: index}))` gán `order` 0..N-1 theo thứ tự client gửi; `postInclude` `orderBy {order: asc}`. KHÔNG migration (PostMedia model + field `order` đã có từ Phase 2). Frontend upload tuần tự N file (mỗi file 1 presign + 1 PUT) rồi 1 lần `POST /posts`.
> **Visibility (follow-aware)**: GET 1 post / list — PUBLIC ai cũng xem; FOLLOWERS chỉ owner + follower; PRIVATE chỉ owner. Non-owner không đủ điều kiện → **404** (ẩn existence), không 403. Gate dùng chung `getViewablePost` (posts.service). Write (PATCH/DELETE) bởi non-owner → 403. Feed loại PRIVATE.
> **Post DTO**: mọi response trả post (single/list/feed) đi qua `serializePost` → kèm `likesCount`, `commentsCount`, `isLikedByMe`, `isFollowingAuthor`.
> **`optionalAuth`** (middleware/auth.ts): verify token nếu có, KHÔNG 401 nếu thiếu — dùng cho route public cần biết viewer.
> **Profile DTO** (`GET /users/:username` → `getUserProfile`): trả `publicUserSelect` (7 field, KHÔNG email) + `postsCount/followersCount/followingCount` + `isFollowing`. `isFollowing` = `null` cho anonymous HOẶC self (backend không tự-follow), `true/false` cho viewer logged-in non-self (reuse `isFollowing()` của follows). `postsCount` **mirror grid** = cùng visibility gating với `listPostsByUsername` (private account + non-owner + non-follower → 0; follower → PUBLIC+FOLLOWERS; ngoài → PUBLIC; owner → cả 3). Schema riêng `userProfileSchema` (KHÁC `userPublicSchema` self có email).
> **Stories (Phase 4.1)**: model **`Story`** (1 story = 1 media — field media phẳng trên row: `mediaUrl/mediaObjectKey/mediaType/thumbnailUrl?/thumbnailObjectKey?/duration?/width?/height?`, KHÔNG child-table như PostMedia) + **`StoryView`** (`@@id([storyId, viewerId])` + `viewer User @relation` FULL parity Like, upsert idempotent). User thêm `stories[]` + `storyViews[]`. **KHÔNG cột visibility** — privacy ở user-level (private account + non-follower → empty, KHÔNG 404; user không tồn tại mới 404). **KHÔNG** reference StoryItem/AudioTrack/audioTrackId (defer 4.3/4.4). `expiresAt = now()+24h` set backend lúc create; active filter `expiresAt > now AND isArchived = false` (cron flip isArchived để 4.4). `serializeStory` **whitelist** (KHÔNG leak `mediaObjectKey`/`thumbnailObjectKey` — làm-đúng-từ-đầu, khác serializePost spread raw). `getStoriesFeed` reuse following-set pattern của `feed.service` + 1 query views (Set, tránh N+1) + group-by-author, sort unseen-first. `listStoriesByUsername` privacy mirror `listPostsByUsername`. Video 15s gate ở **frontend** (backend trust client). **Migration `create_stories`** — chạy `npx prisma migrate dev --name create_stories` khi Docker (Postgres) up (lúc code xong Docker daemon down → chỉ `prisma generate` để có type, migration file CHƯA tạo).
>
> **Story overlays (Phase 4.3a)**: model **`StoryItem`** (`id/storyId/type StoryItemType/x/y/scale @default(1)/rotation @default(0)/payload Json`, FK `onDelete: Cascade`, `@@index([storyId])`) + `Story.items StoryItem[]`. Enum `StoryItemType` khai **đủ 5 value** (`TEXT EMOJI MENTION STICKER TAG`, phase-commented) nhưng Zod `storyItemInputSchema` (discriminatedUnion) **gate chỉ TEXT+EMOJI** ở 4.3a — 4.3b chỉ thêm case Zod, **KHÔNG enum migration** (ALTER TYPE phiền). x/y validate `min(0).max(1)`; payload TEXT `{text ≤200}` / EMOJI `{emoji ≤8}`. `createStorySchema.items` optional `.default([])` (4.1 client zero-break); thêm vào `.object({…})` **trước `.refine`**. `storyResponseSchema.items` (payload `z.record` loose ở doc; serializer whitelist shape thật). `storyInclude.items` **select** (KHÔNG leak storyId) + `orderBy id asc` (cuid monotonic per-process ⇒ = thứ tự client gửi ⇒ z-order ổn định). `serializeStory` whitelist thêm `items`. `createStory` nested-create. Cascade Story→StoryItem ⇒ `deleteStory` (đã dựa cascade cho StoryView) **KHÔNG đổi**. **Migration `20260609095111_add_story_items`** applied. OpenAPI vẫn **25 paths** (discriminatedUnion → `oneOf`, KHÔNG vỡ — KHÔNG cần fallback z.union). Smoke (backend trust client URL, không cần S3): create mix → 201 + ids/defaults/payload; no-items → `[]`; x=1.5 / STICKER / TEXT-thiếu-text → 400; delete → 204 cascade.
>
> **Stories archive + view count (Phase 4.4)**: **cron** `src/jobs/archiveExpiredStories.ts` — `startArchiveJob()` (setInterval **5 phút**, no dep, run-immediately để bù downtime window, `try/catch`+`console.error` KHÔNG throw/crash) wired ở `server.ts` sau `app.listen` (+ `clearInterval` trong shutdown). Sweep `stories.service.archiveExpiredStories()` = `updateMany WHERE isArchived:false AND expiresAt<now SET isArchived:true` (idempotent qua guard `isArchived:false`). **KHÔNG load-bearing** cho visibility (active query đã ẩn expired bằng time-filter) — cron chỉ set cờ cho `/stories/archive` đúng. **`viewCount` OWNER-ONLY**: `storyInclude` thêm `_count.views`; `serializeStory(story, { isViewedByMe, viewerId })` → `viewCount = isOwner ? _count.views : null` (feed loại self ⇒ luôn null trong feed, KHÔNG leak; create=0; own list=number). **Migration `add_storyview_viewedat_index`** (`@@index([storyId, viewedAt(sort: Desc)])`) backing `listStoryViewers` cursor. `listStoryViewers(storyId, viewerId, pagination)`: 404 nếu không tồn tại, **403 trong service** (mirror deleteStory) nếu `authorId !== viewerId`, **KHÔNG filter active** (owner xem viewers của story đã archive); composite-PK cursor `storyId_viewerId` (mirror `listFollowers`, `nextCursor = last.viewerId`), `orderBy viewedAt desc`, include `viewer publicUserSelect` → `{ viewers: [{ user, viewedAt }], nextCursor }`. `listArchivedStories(userId, pagination)`: `WHERE authorId AND isArchived:true`, `orderBy [createdAt desc, id desc]`, cursor on `id` (mirror listPostsByUsername), luôn owner ⇒ viewCount number. **`getUserProfile` thêm `hasActiveStory`** (`userProfileSchema` only, KHÔNG `publicUserSelect`): `findFirst` story active (existence, rẻ hơn count) + cùng privacy gate (`privateHidden` → false). 2 endpoint mới: `GET /stories/archive` đặt **trước** `/:id` routes (tránh nuốt làm id). OpenAPI **27 paths** (25→+2). Smoke 23/23 (API 17 + cron 6). **Browser-verify fix**: `markStoryViewed` **skip self-view** (`select` +authorId, `if authorId===viewerId return` — owner xem own story KHÔNG ghi StoryView row ⇒ owner KHÔNG vào viewers list/viewCount; IG behavior; GIỮ 404 không đổi 410). Cleanup 12 legacy self-view rows (`DELETE … USING "Story" … viewerId=authorId`). Smoke self-skip 6/6.
>
> **Nested comments (Phase 3.3)**: **split endpoints** — `GET /posts/:id/comments` chỉ trả ROOT (`where parentId: null`) + `repliesCount` (`_count.replies`); replies lazy-load qua `GET /comments/:id/replies` (chronological asc). `serializeComment` (mirror `serializePost`) flatten `_count.replies → repliesCount`, KHÔNG leak `_count`. **Flatten-on-create**: `createComment` reassign `parentId = parent.parentId ?? input.parentId` → chain DB tối đa 1 cấp. `deleteComment` **chỉ comment-author** (đổi từ 2.3b-1). Cascade (parent + post `onDelete: Cascade`) đã có từ Phase 2 — **KHÔNG migration**. Routes `/comments/*` tách ra `comments.routes.ts` riêng (mount `/comments` ở server.ts); `GET/POST /posts/:id/comments` ở lại `posts.routes.ts`. Pagination 2 schema riêng (`commentListQuerySchema` default 10 / `replyListQuerySchema` default 4). Response cả 2 endpoint dùng chung `{ comments, nextCursor }`.
>
> **Messaging (Phase 5.1 — Foundation, KHÔNG Socket.io)**: 3 model mới — **`Conversation`** (`type DIRECT|GROUP`, `directKey String? @unique`, `name?/avatarUrl?` GROUP-only, **`lastMessageAt @default(now())`** denormalized cho list ordering, `@@index([lastMessageAt])`) + **`Participant`** (`@@id([conversationId, userId])` composite PK, `lastReadMessageId?` cho read-receipt 5.3, `isAdmin`, `@@index([userId])` "my conversations") + **`Message`** (`contentType MessageContentType`, `content? @db.Text`, `@@index([conversationId, createdAt])`). Enum `MessageContentType` khai **đủ 8 value** (TEXT/EMOJI/POST_SHARE/VOICE/IMAGE/VIDEO/STICKER/GIF) nhưng `sendMessageSchema` Zod **gate `contentType: literal('TEXT')`** (pattern 4.3a). `replyToId`/`sharedPostId` = **scalar-only column** (KHÔNG FK relation — như `Notification.postId/commentId`; relation wired 5.5 reply/post-share). `deletedAt?` soft-delete (recall 5.5). User thêm `sentMessages[]` + `conversations Participant[]`. Migration `create_conversations_and_messages` applied.
> **Race-safe direct (D1)**: `findOrCreateDirectConversation` = `prisma.conversation.upsert({ where:{ directKey } })` với `directKey = [a,b].sort().join(':')` → DB unique constraint đảm bảo 2 click nhanh KHÔNG tạo trùng (cùng idiom upsert-on-unique của Follow/Like/StoryView; **KHÔNG `$transaction`** — repo không dùng transaction). GROUP `directKey = null` (không vướng unique).
> **404-read / 403-write (R2, `prefer-404-over-403-private`)**: `getConversation` + `listMessages` cho non-participant → **404** (ẩn existence, mirror `getViewablePost`); `sendTextMessage` cho non-participant → **403** (write, mirror `updatePost` non-owner). `isParticipant` check qua `Participant` composite-PK `findUnique`.
> **Module split**: 2 endpoint message ở **dưới** `/conversations/:id/messages` (sống trong `conversations.routes` + delegate `messages.service` — pattern `posts/:id/comments` ở `posts.routes`). **KHÔNG `messages.routes.ts`** 5.1 (standalone `/messages/:id` DELETE/reactions defer 5.5). `serializeMessage` whitelist (export cho conversations reuse lastMessage preview); `serializeConversation` whitelist (KHÔNG leak `directKey`). `sendTextMessage` 3 sequential writes (create message → bump conversation `lastMessageAt` → set sender `lastReadMessageId`) no-transaction. OpenAPI: register **Messages trước Conversations** (Conversation `$ref` Message); **32 path keys** (GET+POST `/conversations/:id/messages` = 1 path key, 2 operations). Smoke 31/31 PASS (idempotent 2-direction, self/unknown 400/404, group admin, 404/403 boundary, lastMessageAt bump, validation gate, 401).
>
> **Messaging Realtime (Phase 5.2 — Socket.io)**: `npm i socket.io@4.8` (types built-in). **`src/socket/`** module (5 file): `io.ts` (singleton `io` ref **mirror `lib/prisma.ts`** + emit helper `emitNewMessage`/`emitPresenceOnline`/`emitPresenceOffline` + room name helper `userRoom`/`convoRoom`; **type-only import socket.io** ⇒ `messages.service` import emit helper KHÔNG cycle, 1 chiều service→io.ts), `auth.ts` (`io.use` handshake middleware, JWT ở `socket.handshake.auth.token`, reuse `verifyAccessToken`, gán `socket.data.userId/username`, reject → `connect_error`), `presence.ts` (in-memory `Map<userId,Set<socketId>>` ref-count multi-tab + `Map<userId,Timeout>` offline-debounce **5s** chống flicker khi refresh; `markOnline`→`firstConnection` bool, `scheduleOffline(userId,socketId,onOffline)` chỉ fire khi LAST socket gone + còn offline sau grace, `getOnlinePartners`), `rooms.ts` (`joinUserRoom`/`joinConversation` participant-verified reuse `isParticipant`/`leaveConversation`), `index.ts` (`initSocket(httpServer, corsOrigin)`). **`server.ts`**: `initSocket(server, env.CORS_ORIGIN)` sau `app.listen` (`app.listen()` return = `http.Server`, **KHÔNG cần `http.createServer`**) + `io.close()` trong `shutdown`. **Rooms**: `user:<id>` (join on connect — message:new + presence) + `convo:<id>` (join khi mở thread — typing + read). **Default namespace `/`** (KHÔNG sub-namespace). **Send vẫn REST** (D1): `sendTextMessage` cuối hàm query participantIds + `emitNewMessage` → broadcast tới **user room từng participant** (kể cả sender → multi-tab, client dedup by id). `markConversationRead(convId,userId)` (newest non-deleted msg → set `Participant.lastReadMessageId`, return `{messageId}` hoặc null nếu no-msg/unchanged) + `getConversationPartners(userId)` (distinct partner ids cho presence fan-out). `isParticipant` **export** (reuse socket layer). **`serializeConversation` participants thêm `lastReadMessageId`** (read-receipt cursor; `participantResponseSchema` += `z.string().nullable()` — OpenAPI tự lan vì Conversation `$ref` participant, **vẫn 32 paths**). Presence **contact-scoped** (D2): connect → emit `presence:online` cho partners (chỉ tab đầu) + `presence:snapshot` cho mình; disconnect (tab cuối, sau 5s) → persist `lastSeenAt` + emit `presence:offline`. Typing server enrich username, `socket.to(convoRoom)` exclude người gõ. **KHÔNG model mới** ngoài `User.lastSeenAt DateTime?` (migration `add_user_last_seen_at`). Smoke socket 12/12 PASS (invalid JWT→connect_error, snapshot, online/offline 5s-debounce, message:new broadcast, typing exclude-self, read-receipt).
> **⚠️ GOTCHA listener-order (5.2 follow-up fix)**: trong `io.on('connection')`, **PHẢI đăng ký mọi `socket.on(...)` ĐỒNG BỘ trước bất kỳ `await`** nào. Bug đã gặp: handler `async` await `getConversationPartners()` (presence) TRƯỚC khi gắn listener `conversation:join`/`typing`/`message:read` → client emit `conversation:join` ngay sau connect rơi vào cửa sổ await → Socket.io DROP event (chưa có listener) → recipient không vào convo room → typing/read-receipt im lặng. `message:new` không dính vì `joinUserRoom` sync trước await. Fix: listeners trước, presence chuyển xuống `void (async()=>{…})()` cuối handler. `presence:snapshot` payload = `{ online: userId[], lastSeen: Record<userId,ISO> }` (lastSeen query `User.lastSeenAt` cho partnerIds — để partner offline-sẵn hiện "Active X ago").

## Khi thêm feature mới

1. Sửa `prisma/schema.prisma`
2. `npx prisma migrate dev --name <desc>`
3. Tạo `src/modules/<feature>/` với 3 files (routes, service, schema)
4. Register router vào `src/server.ts`: `app.use('/<feature>', <feature>Routes)`
5. Tạo `src/modules/<feature>/<feature>.openapi.ts` (đăng ký paths + response schemas qua `OpenAPIRegistry`). **BẮT BUỘC** wire vào `lib/openapi.ts`: thêm `require(...)` + gọi `registerXOpenApi(registry)` trong `registerAll()`, và thêm tag vào mảng `tags` của `buildOpenApiDocument()` — quên bước này thì Swagger KHÔNG thấy endpoint.
6. Update bảng endpoints trong file này

## Anti-patterns backend

- ❌ Lưu logic vào routes (move qua service)
- ❌ Trả password/passwordHash về client
- ❌ Validate manually thay vì dùng Zod middleware
- ❌ Tạo singleton mới cho Prisma — luôn import từ `lib/prisma.ts`
- ❌ Đọc `process.env` trực tiếp — luôn dùng `env` từ `config/env.ts`
- ❌ Console.log lung tung — sau này thêm pino logger

## Debug protocol

Khi user báo bug:
1. KHÔNG sửa ngay — investigate trước
2. Đọc code liên quan + reproduce mental model
3. Đề xuất root cause + fix cụ thể
4. Đợi user confirm trước khi sửa

Áp dụng cho mọi bug, kể cả "rõ ràng".