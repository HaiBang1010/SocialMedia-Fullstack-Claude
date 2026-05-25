# Backend — Phase 1 Setup Guide

Hướng dẫn từng bước cho người mới. Đọc và làm theo thứ tự, đừng nhảy bước.

## Bạn cần chuẩn bị

| Tool | Vì sao | Cài ở đâu |
|---|---|---|
| Node.js 20+ | Chạy backend | https://nodejs.org (chọn LTS) |
| Docker Desktop | Chạy PostgreSQL | https://docker.com |
| Code editor | Sửa code | VS Code (https://code.visualstudio.com) |
| Postman hoặc curl | Test API | Postman (https://postman.com) |

Sau khi cài, mở terminal và check version để confirm:
```bash
node --version    # v20.x.x trở lên
docker --version  # Docker version 24.x.x trở lên
```

---

## Bước 1 — Đặt thư mục backend vào project của bạn

Bạn đang ở `social-media/`. Copy folder `backend/` này vào đó. Cấu trúc cuối cùng:

```
social-media/
├── backend/         ← từ guide này
└── frontend/        ← phase sau
```

Vào folder backend trong terminal:
```bash
cd social-media/backend
```

---

## Bước 2 — Cài dependencies

```bash
npm install
```

Lệnh này đọc `package.json` và tải toàn bộ thư viện về `node_modules/`. Mất ~1-2 phút.

> 💡 **Không bao giờ commit `node_modules/` lên Git** — nó nặng và có thể tự cài lại bằng `npm install`. File `.gitignore` đã loại trừ sẵn.

---

## Bước 3 — Khởi động PostgreSQL bằng Docker

Tại sao Docker? — Để khỏi phải cài Postgres trực tiếp lên máy. Mỗi project 1 DB riêng, không xung đột, dọn dẹp dễ.

Khởi động Postgres ở chế độ chạy nền:
```bash
docker compose up -d
```

Verify Postgres đã chạy:
```bash
docker compose ps
```

Bạn sẽ thấy container `social-media-postgres` ở trạng thái `healthy` hoặc `running`.

> ⚠️ **Nếu lỗi `port 5432 already in use`**: bạn có Postgres khác đang chạy. Hoặc tắt nó, hoặc đổi port trong `docker-compose.yml` (vd `"5433:5432"`) và sửa `DATABASE_URL` tương ứng.

---

## Bước 4 — Tạo file `.env` từ template

```bash
cp .env.example .env
```

(Trên Windows: `copy .env.example .env`)

Mở file `.env` ra. **BẮT BUỘC đổi 2 secret này** (random ít nhất 32 ký tự):
```
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
```

Cách tạo random secret nhanh:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Chạy 2 lần, dán vào 2 biến.

---

## Bước 5 — Tạo database schema bằng Prisma

```bash
npx prisma migrate dev --name init
```

Lệnh này:
1. Đọc `prisma/schema.prisma`
2. Tạo file SQL migration trong `prisma/migrations/`
3. Apply lên Postgres → tạo bảng `User`
4. Generate Prisma Client (typed query API) trong `node_modules/`

Verify schema đã tạo:
```bash
npx prisma studio
```

→ Mở browser ở http://localhost:5555. Bạn thấy bảng `User` rỗng. Đóng tab khi xong.

---

## Bước 6 — Chạy server

```bash
npm run dev
```

Bạn sẽ thấy:
```
🚀 Server chạy tại http://0.0.0.0:3000
   Environment: development
```

Test health check (mở terminal khác):
```bash
curl http://localhost:3000/health
```

Trả về:
```json
{"status":"ok","timestamp":"2026-..."}
```

→ **Server hoạt động!** Để chạy chế độ watch (auto reload khi sửa code), cứ để `npm run dev` chạy trong terminal đó.

---

## Bước 7 — Test toàn bộ flow auth bằng curl

### 7.1 Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

Response (201):
```json
{
  "user": { "id": "...", "username": "test_user", ... },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**LƯU LẠI** `accessToken` để dùng ở bước sau.

### 7.2 Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "password123"
  }'
```

(`identifier` có thể là email HOẶC username)

### 7.3 Get current user (cần token)

Thay `<TOKEN>` bằng accessToken từ bước 7.1:
```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

Trả về user info hiện tại.

### 7.4 Update profile

```bash
curl -X PATCH http://localhost:3000/users/me \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Hello world!", "name": "New Name"}'
```

### 7.5 Test các trường hợp lỗi

**Register trùng email** → 409 Conflict:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test_user2","email":"test@example.com","password":"password123","name":"x"}'
```

**Login sai password** → 401:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"wrong"}'
```

**Truy cập /auth/me không token** → 401:
```bash
curl http://localhost:3000/auth/me
```

**Validation lỗi (password ngắn)** → 400 với chi tiết:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"x","email":"bad","password":"123","name":""}'
```

---

## Khi gặp lỗi, kiểm tra theo thứ tự

1. Postgres có chạy không? → `docker compose ps`
2. `.env` có đúng `DATABASE_URL` và 2 JWT_SECRET không?
3. Migration đã chạy chưa? → `npx prisma studio` xem có bảng User không
4. Server đang chạy? → `npm run dev` có log không?
5. Đọc log server — error message thường khá rõ.

---

## Mỗi file để làm gì

```
backend/
├── docker-compose.yml      → Postgres container
├── package.json            → list deps + npm scripts
├── tsconfig.json           → TypeScript settings
├── .env                    → secrets (KHÔNG commit)
├── .env.example            → template (commit)
├── .gitignore
│
├── prisma/
│   └── schema.prisma       → định nghĩa bảng → Prisma generate code
│
└── src/
    ├── server.ts           → Express app entry, đăng ký middleware + routes
    │
    ├── config/
    │   └── env.ts          → đọc .env + validate bằng Zod
    │
    ├── lib/                → utilities tái dùng nhiều nơi
    │   ├── prisma.ts       → singleton Prisma client
    │   ├── jwt.ts          → sign/verify JWT
    │   └── password.ts     → hash/verify password
    │
    ├── middleware/         → các Express middleware
    │   ├── auth.ts         → requireAuth (verify JWT)
    │   ├── validate.ts     → validate request body bằng Zod
    │   ├── asyncHandler.ts → bọc async route, bắt lỗi
    │   └── error.ts        → error handler tập trung
    │
    └── modules/            → mỗi feature 1 folder
        ├── auth/
        │   ├── auth.routes.ts   → định nghĩa endpoints
        │   ├── auth.service.ts  → logic nghiệp vụ
        │   └── auth.schema.ts   → Zod validation schemas
        └── users/
            ├── users.routes.ts
            ├── users.service.ts
            └── users.schema.ts
```

**Quy ước**: routes chỉ điều phối (gọi service, trả response). KHÔNG viết logic phức tạp trong routes. Logic ở **service**. Sau này dễ test và reuse.

---

## Lệnh hay dùng

```bash
npm run dev               # chạy dev server (auto reload)
npm run prisma:studio     # GUI xem/sửa data trong DB
npm run prisma:migrate    # tạo migration mới khi sửa schema
docker compose up -d      # start Postgres
docker compose down       # dừng Postgres (không xóa data)
docker compose down -v    # dừng + xóa hết data (reset DB)
```

---

## Khi nào sang Phase tiếp?

Khi bạn đã làm được TẤT CẢ:
- [x] Server chạy không lỗi
- [x] Register tạo được user (check `npx prisma studio`)
- [x] Login trả về token
- [x] `GET /auth/me` với token trả đúng user
- [x] Update profile thành công
- [x] Test các case lỗi (409, 401, 400) đều hoạt động

→ Báo tôi xong, tôi sẽ làm tiếp **frontend** (Vite + React + UI auth).
