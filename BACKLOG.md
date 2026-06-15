# Backlog

> Issue, tech debt, ideas — chưa làm nhưng không quên.
> Quy ước: [scope] mô tả ngắn — lý do/context

## Phase 2 — Scope notes (BE + FE 2.4/2.5 đã xong)

- [ ] [scope] Phase 2 chỉ đăng 1 ẢNH ĐƠN. Carousel multi-image đẩy về Phase 3.

## P1 — Sắp tới (làm trong phase hiện tại nếu có thời gian)

(empty)

## Phase 5.5 — Defer (đóng Phase 5; tách khỏi scope create+recall)

- [ ] [backend+frontend/messaging] **Reply-to message** — `Message.replyToId` scalar đã có sẵn (5.1) nhưng CHƯA wire FK relation + UI quote-bubble + @-jump. Defer khỏi 5.5 (chỉ làm group create + recall).
- [ ] [backend+frontend/messaging] **Group management** — add/remove/kick members, leave group, rename/đổi avatar group, admin transfer. 5.5 chỉ tạo group; quản lý sau (cần endpoints + Participant mutation + UI settings).
- [ ] [backend/messages] **Orphan S3 cleanup cron** — recall xóa S3 best-effort (soft-fail); thêm sweep cron quét object mồ côi (khớp debt Posts/Stories "orphan check Phase polish"). Cũng gom: recall giữ lại `MessageMedia` rows (chỉ xóa S3) → hard-delete rows.
- [ ] [frontend/messaging] **GroupCreateModal pagination** — hiện load toàn bộ recent+mutual không cursor (pool nhỏ chấp nhận). Cursor/virtualize khi user có nhiều follow.

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

- [P3] [frontend/story-viewer] Archive viewer auto-advance qua page boundary
      (Checkpoint 4.4): hết loaded set → `fetchNextPage()` + index++ (spinner ngắn
      tới khi page kế load). Chấp nhận; nâng = prefetch-on-near-end nếu cần mượt.
- [P3] [backend/stories] viewCount = `_count.views` aggregate mỗi story kể cả trong
      feed (Checkpoint 4.4) — feed luôn trả `null` (non-owner, no leak) nhưng vẫn chạy
      aggregate per row. Tối ưu (skip aggregate khi không phải owner) nếu feed phình.

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


## Phase 4.3b — Stories overlays (defer)

- [P3] [frontend/story-overlay] Multi-touch scale/rotate overlays — pinch-zoom + 2-finger
      rotate cho StoryItem (4.3a chỉ drag; field `scale`/`rotation` đã có DB, default 1/0).
- [P3] [frontend/story-overlay] MENTION/STICKER/TAG overlay types — enum `StoryItemType` đã
      khai đủ 5 value (DB) + Zod gate 2 (TEXT/EMOJI); chỉ cần thêm discriminated case Zod +
      render component (MENTION → link profile, TAG, STICKER picker). KHÔNG enum migration.

## Phase 5+ — defer (cần messaging / socket)

- [P3] [stories] Story reactions (heart/tym) — wire với messaging (reaction → DM owner).
- [P3] [stories] Reply input ở story viewer (bottom chrome `h-20` hiện placeholder) — wire DM.
- [P3] [stories] WebSocket realtime view count update (Checkpoint 4.4) — hiện owner
      refetch/reopen mới thấy count tăng; realtime cần socket (Phase 5).

## Phase polish — Stories

- [P3] [frontend/story-viewer] Mute state lift → store (persist across stories + reset về
      default mỗi lần mở). Hiện `muted` là component state: KHÔNG persist khi đổi story,
      KHÔNG reset khi reopen (session trước fallback→muted thì reopen giữ muted).
- [P3] [frontend/story-viewer] Bottom sheet UI cho ViewersListModal trên mobile — hiện
      Radix Dialog centered `max-w-md`; IG dùng bottom sheet kéo lên.
[Phase polish]:
- Auto-retry failed message on reconnect (Option C queue pattern)
- Distinguish network vs validation errors for retry button visibility
- Multi-message retry batch (currently per-message only)
- Seen behavior toggle (IG default vs hide-on-reply) settings
- [P2] [frontend/app-wide] Toast notification system thay inline error text — UX nhất quán cho
      mọi error/success toàn app (hiện mỗi nơi tự render inline text + tự-dismiss timeout/manual).
      Library candidate: **sonner** (shadcn-compat) hoặc react-hot-toast. Files affected:
      MessageInput (attach limit/validate errors), StoryComposer (upload error), useReactToMessage
      (error), upload errors (useCreateStory/useCreatePost), auth errors (login/register).
      Ref: https://sonner.emilkowal.ski/

[Phase 5.3]:
- Typing in conversation list view ("typing..." subtitle indicator)
- Unread badge count

[Phase 5.4a — media messages, defer]:
- [P2] [backend/messages] Orphan S3 media cleanup: upload xong nhưng POST message fail / user bỏ
      composer → object mồ côi (khớp debt Posts/Stories "orphan check để Phase polish"). MessageMedia
      đã lưu `objectKey`/`thumbnailObjectKey` ⇒ recall (5.5) xóa được; orphan-sweep cron = Phase polish.
- [P3] [frontend/messaging] Drag-drop file vào thread + paste ảnh từ clipboard (nice-to-have).
- [P3] [frontend/messaging] Reorder media trước khi gửi (kéo sắp xếp preview strip).
- [P3] [frontend/messaging] Edit caption sau khi gửi (cần 5.5 message edit).
- [P3] [frontend/messaging] Pinch-zoom ảnh trong MediaLightbox (mobile); hiện chỉ swipe + arrows.
- [P3] [frontend/messaging] Thumbnail ceiling 512px — nếu single-image trông mềm trên màn lớn,
      nâng ceiling hoặc dùng `url` gốc cho single-image grid cell.

[Phase 5.4b — voice messages, defer]:
- [P2] [frontend/messaging] Safari/iOS voice: MediaRecorder KHÔNG hỗ trợ `audio/webm` (chỉ
      `audio/mp4`) → hiện báo "not supported". Thêm `audio/mp4` (presign enum + `EXT_BY_MIME` +
      recorder pick `isTypeSupported` ưu tiên webm fallback mp4) để Safari ghi âm được.
- [P3] [frontend/messaging] Pause/resume recording + real waveform (decode audio buffer) +
      trim/preview-before-send (hiện tap stop = auto-send ngay, KHÔNG nghe lại trước khi gửi).
## DONE

- 2026-06-10 [frontend/story-viewer] Bar↔video desync khi reopen video (progress bar chạy
  nhưng video đứng) — Checkpoint 4.4 follow-up. Fix: thêm `isOpen` vào deps effect video
  play/pause (viewer không unmount khi close → `currentStory.id` persist → deps không đổi →
  effect không re-fire → `<video>` remount mới không được gọi `play()`). Bao phủ luôn
  tech-debt "bar↔video drift" ghi nhận ở 4.2.
- 2026-06-09 [frontend/story-viewer] Profile-entry-point cho viewer (single-user mode) —
  Checkpoint 4.4. Avatar profile có ring coral khi `hasActiveStory` → mở viewer
  single-user mode. Cross-user OFF. Delete reachable (archive + single-user). 4.2 đã
  làm phần data-source fallback; 4.4 hoàn tất UI entry point.
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