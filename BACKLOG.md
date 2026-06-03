# Backlog

> Issue, tech debt, ideas — chưa làm nhưng không quên.
> Quy ước: [scope] mô tả ngắn — lý do/context

## Phase 2 — In progress (chưa bắt đầu)

- [ ] [scope] Phase 2 chỉ đăng 1 ẢNH ĐƠN. Carousel multi-image đẩy về Phase 3.

## P1 — Sắp tới (làm trong phase hiện tại nếu có thời gian)

(empty)

## P2 — Sau (làm trong phase tiếp theo)

- [ ] [backend/lib/jwt] Tách error types: TokenExpired vs WrongTokenType vs InvalidSignature. Hiện gộp chung message → khó debug khi user báo lỗi.
- [ ] [backend/middleware/error] Thêm pino logger thay console.log.
- [ ] [backend/modules/users] userPublicSchema (Zod) duplicate với publicUserSelect (Prisma). Sửa field phải đồng bộ 2 chỗ. Cân nhắc generate Zod từ Prisma (prisma-zod-generator) khi schema lớn hơn.
- [ ] [frontend/auth] Token lưu localStorage (authStore persist) → XSS đọc được. Phase polish: chuyển refresh token sang httpOnly cookie. Phase 1 chấp nhận trade-off.
- [P2] [backend/follows] Follow approval flow cho private accounts. 
  Hiện tại: ai follow cũng instant approve (không có Follow.status enum). 
  Phase polish: thêm enum PENDING/ACCEPTED + endpoints accept/reject + 
  Notification tích hợp. Đây là feature IG thật có.
- [P2] [frontend/feed] Cuộn xuống infinite scroll (useInfiniteQuery + 
  IntersectionObserver, không phân trang button). Backend cursor pagination 
  đã sẵn sàng — chỉ frontend implement.
- [P2] [frontend/feed] "Reload sau idle ~5 phút" — quyết định cách 
  (TanStack staleTime + refetchOnFocus / idle detection + banner / polling) 
  khi tới Phase 2.4. IG-like behavior.

## P3 — Sau nữa (nice-to-have, có thể không làm)

"switch sang openapi-typescript khi >15 endpoints"

- [ ] [backend/media] Image transform (thumbnail, resize) — Phase 2 chỉ lưu original; thumbnail server-side hoặc on-the-fly cân nhắc Phase polish.
- [ ] [backend/feed] Feed cải tiến — Phase 2 dùng follow+random simple. Personalized ranking, recency weight, engagement signals → Phase polish.
- [ ] [backend/storage] Automate MinIO setup — viết script bash hoặc 
      docker-compose init container chạy `mc alias set` + `mc mb` + 
      `mc anonymous set download` tự động khi `docker compose up`. 
      Hiện tại bucket + policy phải tạo tay sau mỗi lần `down -v`.
- [ ] [backend/storage] Creds MinIO hardcode `minio`/`minio12345` trong 
      docker-compose.yml (dev only). Phase polish: chuyển sang env var 
      (`${MINIO_ROOT_USER}`...) + secret thật cho prod, không commit creds.


## DONE

(empty, khi xong move xuống đây với date)