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
| GET | `/users/:username` | - | profile public |
| PATCH | `/users/me` | ✓ | sửa profile |

Khi thêm endpoint mới, update bảng trên.

## Khi thêm feature mới

1. Sửa `prisma/schema.prisma`
2. `npx prisma migrate dev --name <desc>`
3. Tạo `src/modules/<feature>/` với 3 files (routes, service, schema)
4. Register router vào `src/server.ts`: `app.use('/<feature>', <feature>Routes)`
5. Tạo `src/modules/<feature>/<feature>.openapi.ts` (đăng ký paths + response schemas qua `OpenAPIRegistry`) và import vào `lib/openapi.ts` để Swagger UI tự cập nhật.
6. Update bảng endpoints trong file này

## Anti-patterns backend

- ❌ Lưu logic vào routes (move qua service)
- ❌ Trả password/passwordHash về client
- ❌ Validate manually thay vì dùng Zod middleware
- ❌ Tạo singleton mới cho Prisma — luôn import từ `lib/prisma.ts`
- ❌ Đọc `process.env` trực tiếp — luôn dùng `env` từ `config/env.ts`
- ❌ Console.log lung tung — sau này thêm pino logger
