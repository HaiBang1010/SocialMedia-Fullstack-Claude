# Backlog

> Issue, tech debt, ideas — chưa làm nhưng không quên.
> Quy ước: [scope] mô tả ngắn — lý do/context

## P1 — Sắp tới (làm trong phase hiện tại nếu có thời gian)

(empty)

## P2 — Sau (làm trong phase tiếp theo)

- [ ] [backend/lib/jwt] Tách error types: TokenExpired vs WrongTokenType vs InvalidSignature. Hiện gộp chung message → khó debug khi user báo lỗi.
- [ ] [backend/middleware/error] Thêm pino logger thay console.log.
- [ ] [backend/modules/users] userPublicSchema (Zod) duplicate với publicUserSelect (Prisma). Sửa field phải đồng bộ 2 chỗ. Cân nhắc generate Zod từ Prisma (prisma-zod-generator) khi schema lớn hơn.
- [ ] [frontend/auth] Token lưu localStorage (authStore persist) → XSS đọc được. Phase polish: chuyển refresh token sang httpOnly cookie. Phase 1 chấp nhận trade-off.

## P3 — Sau nữa (nice-to-have, có thể không làm)

"switch sang openapi-typescript khi >15 endpoints"

## DONE

(empty, khi xong move xuống đây với date)