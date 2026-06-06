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
| POST | `/posts/:id/comments` | ✓ | thêm comment |
| GET | `/posts/:id/comments` | optional | list comment (newest first, cursor) |
| PATCH | `/comments/:id` | ✓ | sửa comment (author) |
| DELETE | `/comments/:id` | ✓ | xóa comment (author hoặc post owner) |
| POST | `/users/:username/follow` | ✓ | follow user (idempotent) |
| DELETE | `/users/:username/follow` | ✓ | unfollow user (idempotent) |
| GET | `/users/:username/followers` | optional | list followers (cursor) |
| GET | `/users/:username/following` | optional | list following (cursor) |
| GET | `/feed` | ✓ | personalized feed (following users, 14 ngày, cursor) |

Khi thêm endpoint mới, update bảng trên.

> **PostMedia.objectKey** lưu S3 key (không chỉ URL) để `DeleteObject` khi xóa post — URL không đủ vì public-read URL có thể khác key. Xóa S3 là best-effort: fail thì log, không chặn DB delete.
> **Carousel (Phase 3.1)**: `POST /posts` nhận `media[]` tối đa **5** (`createPostSchema.media.max(5)`). `createPost` đã `map((m, index) => ({...m, order: index}))` gán `order` 0..N-1 theo thứ tự client gửi; `postInclude` `orderBy {order: asc}`. KHÔNG migration (PostMedia model + field `order` đã có từ Phase 2). Frontend upload tuần tự N file (mỗi file 1 presign + 1 PUT) rồi 1 lần `POST /posts`.
> **Visibility (follow-aware)**: GET 1 post / list — PUBLIC ai cũng xem; FOLLOWERS chỉ owner + follower; PRIVATE chỉ owner. Non-owner không đủ điều kiện → **404** (ẩn existence), không 403. Gate dùng chung `getViewablePost` (posts.service). Write (PATCH/DELETE) bởi non-owner → 403. Feed loại PRIVATE.
> **Post DTO**: mọi response trả post (single/list/feed) đi qua `serializePost` → kèm `likesCount`, `commentsCount`, `isLikedByMe`, `isFollowingAuthor`.
> **`optionalAuth`** (middleware/auth.ts): verify token nếu có, KHÔNG 401 nếu thiếu — dùng cho route public cần biết viewer.
> **Profile DTO** (`GET /users/:username` → `getUserProfile`): trả `publicUserSelect` (7 field, KHÔNG email) + `postsCount/followersCount/followingCount` + `isFollowing`. `isFollowing` = `null` cho anonymous HOẶC self (backend không tự-follow), `true/false` cho viewer logged-in non-self (reuse `isFollowing()` của follows). `postsCount` **mirror grid** = cùng visibility gating với `listPostsByUsername` (private account + non-owner + non-follower → 0; follower → PUBLIC+FOLLOWERS; ngoài → PUBLIC; owner → cả 3). Schema riêng `userProfileSchema` (KHÁC `userPublicSchema` self có email).

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