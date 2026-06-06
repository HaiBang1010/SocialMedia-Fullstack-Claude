# Backlog

> Issue, tech debt, ideas — chưa làm nhưng không quên.
> Quy ước: [scope] mô tả ngắn — lý do/context

## Phase 2 — Scope notes (BE + FE 2.4/2.5 đã xong)

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
- [P2] [frontend/feed] "Reload sau idle ~5 phút" — quyết định cách 
  (TanStack staleTime + refetchOnFocus / idle detection + banner / polling) 
  khi tới Phase 2.4. IG-like behavior.

## P3 — Sau nữa (nice-to-have, có thể không làm)

"switch sang openapi-typescript khi >15 endpoints"

- [P3] [frontend/feed] useFeed nhận custom limit khi cần (vd discover feed).
  Hiện tại no-arg, dùng backend default 20.

- [ ] [backend/media] Image transform (thumbnail, resize) — Phase 2 chỉ lưu original; thumbnail server-side hoặc on-the-fly cân nhắc Phase polish.
- [ ] [backend/feed] Feed cải tiến — Phase 2 dùng follow+random simple. Personalized ranking, recency weight, engagement signals → Phase polish.
- [ ] [backend/storage] Automate MinIO setup — viết script bash hoặc 
      docker-compose init container chạy `mc alias set` + `mc mb` + 
      `mc anonymous set download` tự động khi `docker compose up`. 
      Hiện tại bucket + policy phải tạo tay sau mỗi lần `down -v`.
- [ ] [backend/storage] Creds MinIO hardcode `minio`/`minio12345` trong 
      docker-compose.yml (dev only). Phase polish: chuyển sang env var 
      (`${MINIO_ROOT_USER}`...) + secret thật cho prod, không commit creds.
- [P3] [backend/media] Orphan S3 cleanup khi multi-image upload partial fail
      (Checkpoint 3.1). 1 trong N PUT fail → ảnh đã upload thành object không
      reference trong DB; retry hiện re-upload TOÀN BỘ → thêm orphan. Solution:
      (a) memo uploaded `MediaInput[]` theo image id để retry skip file đã xong,
      hoặc (b) periodic cleanup job xóa objects không reference trong DB.
- [P3] [frontend/composer] Pointer-drag reorder cho `ImageStrip` (Checkpoint
      3.1). Hiện dùng nút ◀▶ swap neighbour (ít code, no dep) — nâng lên kéo-thả
      như IG khi có thời gian.


## DONE

- 2026-06-06 [frontend/profile] Followers/following count placeholder `0` →
  count THẬT — Checkpoint 2.5. Backend `GET /users/:username` trả ProfileUser
  (postsCount/followersCount/followingCount + isFollowing). postsCount mirror grid.
- 2026-06-06 [frontend/profile] Public profile route `/users/:username` —
  Checkpoint 2.5. `UserProfilePage` (merge từ ProfilePage), `/profile` redirect.
  Follow button (optimistic + invalidate onSettled).
- 2026-06-06 [frontend/post] Author name/avatar clickable → `/users/:username` —
  Checkpoint 2.5. Wire `<Link>` ở PostCard/PostDetailView/CommentItem.
- 2026-06-03 [frontend/feed] Infinite scroll feed (useInfiniteQuery +
  IntersectionObserver, không phân trang button) — Checkpoint 2.4b. Hand-roll
  `useInfiniteScroll` (no dep). Dùng chung FeedPage + CommentList.