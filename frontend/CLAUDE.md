# Frontend — Project Memory

> Phase 1A/1B/1C + Phase 2 FE (2.4a/b/c posts UI + 2.5 follow/profile counts/public profile) + Phase 3 FE (3.1 carousel + 3.2 video/delete/visibility + 3.3 nested comments) đã build xong. File này là rules + setup thực tế; xem các section "Phase 2.4a"/"Phase 2.5 — DONE"/"Phase 3.1 — DONE"/"Phase 3.3 — DONE" cuối file cho chi tiết.

## Stack versions (pinned)

> Pin cứng — KHÔNG để `create-vite` kéo bản mới hơn. Lý do: create-vite latest kéo React 19 + Vite 8 (rolldown) + TS 6, lệch stack đã chốt và Vite 8 vỡ trên Node < 22.12.

- **React 18** (pinned — KHÔNG React 19)
- **Vite 5** (esbuild, KHÔNG rolldown như Vite 8)
- **TypeScript 5.6** (KHÔNG TS 6 — option như `erasableSyntaxOnly` không tồn tại ở 5.6)
- **React Router 6** (KHÔNG v7)
- **Tailwind CSS v4** (CSS-first — KHÔNG có `tailwind.config.js`)
- **Node ≥ 22.12 khuyến nghị** — hiện chạy 22.1.0 với warning, Vite 5 vẫn chạy được

## Tailwind v4 conventions

- Theme config nằm trong `src/index.css` qua directive `@theme` — **KHÔNG có `tailwind.config.js`**
- Plugin Vite: `@tailwindcss/vite` trong `vite.config.ts` (KHÔNG postcss config riêng)
- CSS variables dùng color space **oklch** (warm-neutral base + coral primary — theme "Beng"), khai báo ở `:root` + `.dark`
- `cn()` helper ở `src/lib/utils.ts` (clsx + tailwind-merge)
- Khi thêm shadcn component: dùng bản **v4-compatible** (CLI `npx shadcn@latest add ...`)
- Community shadcn components viết cho v3 cần adapt: `tailwind.config` → `@theme`, `hsl(...)` → `oklch(...)`

## Stack đã chốt

- **Build tool**: Vite (KHÔNG Next.js, KHÔNG CRA)
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4 (CSS-first) — Shadcn/ui — utility-first
- **UI state**: Zustand (auth, UI, calls)
- **Server state**: TanStack Query (KHÔNG dùng useEffect + fetch để query data)
- **HTTP**: axios với interceptor để gắn JWT + auto-refresh
- **Routing**: React Router v6
- **Forms**: react-hook-form + Zod (share schema với backend)
- **Real-time** (sau): socket.io-client
- **WebRTC** (sau): simple-peer

## Cấu trúc khi build

```
frontend/src/
├── main.tsx, App.tsx
├── api/              ← axios client + functions gọi backend
├── components/
│   ├── ui/           ← atomic: Button, Input, Modal, Avatar
│   ├── post/         ← PostCard, PostComposer, CommentTree
│   ├── story/
│   ├── chat/
│   └── profile/
├── features/         ← business logic (hooks, stores theo feature)
├── hooks/            ← shared hooks (useSocket, useMediaUpload)
├── stores/           ← Zustand stores
├── lib/              ← socket.ts, peer.ts, format.ts
├── pages/            ← route components
└── types/            ← types share với backend
```

## Patterns sẽ áp dụng

### Server state với TanStack Query
- ❌ KHÔNG `useEffect(() => fetch(...))` để load data
- ✅ `useQuery({ queryKey: ['posts'], queryFn: api.posts.list })`
- Mutations qua `useMutation`, invalidate queries sau success

### Auth state
- Zustand store `authStore` lưu: user, accessToken, refreshToken, isAuthenticated
- Token persist qua `localStorage` (Phase 1 — biết là không tối ưu security, sẽ refactor sang httpOnly cookie ở Phase polish)
- Axios interceptor tự gắn `Authorization` header + retry với refresh khi 401

### Routing
- Protected routes wrap qua `<ProtectedRoute>` component
- Unauthenticated → redirect `/login`

### Components
- 1 component / 1 file
- Props interface ngay trên component: `interface PostCardProps { ... }`
- Export default cho component chính, named export cho phụ
- KHÔNG inline-style trừ trường hợp dynamic — dùng Tailwind classes

### Tailwind (v4 CSS-first)
- KHÔNG có `tailwind.config.js` — custom theme (colors/fonts) khai báo trong `src/index.css` qua `@theme`, color space oklch
- Plugin build qua `@tailwindcss/vite` trong `vite.config.ts` (KHÔNG postcss config riêng)
- KHÔNG arbitrary values lung tung (`bg-[#abcdef]`) — define trong `@theme` nếu dùng nhiều lần
- Sort classes theo: layout → spacing → typography → colors → effects

### Forms
- react-hook-form cho mọi form > 2 fields
- Zod schema validate, share file với backend nếu được
- Show inline error dưới field, không alert

## Anti-patterns frontend

- ❌ Class components — chỉ function components + hooks
- ❌ Redux/MobX — Zustand đủ cho project này
- ❌ CSS-in-JS (styled-components, emotion) — dùng Tailwind
- ❌ React Context cho server state — dùng TanStack Query
- ❌ Inline functions trong render gây re-render — dùng `useCallback` khi cần
- ❌ Any types — strict TypeScript, dùng `unknown` rồi narrow nếu chưa biết
- ❌ Default export object có nhiều thứ — named exports cho clarity

## Backend API base URL

Dev: `http://localhost:3000`
Prod: TBD

Lưu trong `.env`:
```
VITE_API_URL=http://localhost:3000
```

(Vite require prefix `VITE_` cho env vars được expose ra client.)

## Media upload pattern (Phase 2+)

- Upload qua **presigned URL**: client gọi `POST /media/presign` (body `{ contentType, size }`) → nhận `{ uploadUrl, publicUrl, objectKey, expiresIn }` → `PUT` file lên `uploadUrl` qua axios instance riêng (`api/upload-client.ts` — KHÔNG gắn JWT, KHÔNG refresh interceptor, có progress) → `POST /posts` với media `{ url: publicUrl, objectKey, width?, height? }`.
- KHÔNG upload file qua backend (backend chỉ cấp presign + nhận URL).
- **Backend contract** (`backend/.../media.schema.ts`): `contentType` ∈ {`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`} — **5 MIME**; `size` max **10MB**. (Note cũ ghi 3 MIME / 5MB là stale — đã sửa cho khớp wire.)
- **Client-side validation**: giá trị thực thi chốt ở **Phase 2.4b** (create-post composer), CHƯA implement ở 2.4a (read-only). Có thể siết hẹp hơn backend (vd chỉ jpeg/png/webp + 5MB) như UX choice, miễn là **⊆ backend contract**.

## Phase 1A/1B/1C deliverables — DONE

**Phase 1A — Foundation:**
- [x] Vite 5 + React 18 + TS 5.6 + Tailwind v4 + shadcn init
- [x] Axios client + interceptor (auto refresh, refresh singleton, circular guard)
- [x] Zustand authStore (persist localStorage) + TanStack Query setup
- [x] React Router + ProtectedRoute + PublicOnlyRoute + 4 page

**Phase 1B — Auth UI:**
- [x] Login/Register form thực (react-hook-form + Zod, shadcn Card/Form/Input/Button)
- [x] Profile view + edit (PATCH /users/me); error mapping 400 field errors + 409 conflict

**Phase 1C — Design system "Beng" + layout + dark mode:**
- [x] Override shadcn token → warm-neutral + coral; fonts Bricolage Grotesque + Plus Jakarta Sans
- [x] Layout shell: AppLayout (Sidebar | main | RightRail + BottomNav), AuthLayout (split coral panel)
- [x] Dark mode: themeStore + useThemeEffect + ThemeToggle + FOUC script

> **Phase 1A/1B/1C DONE.**

## Phase 2.4a — Data layer foundation (read-only) — DONE

Backend-integration plumbing cho posts/feed/comments/likes/follows/media. **KHÔNG UI, KHÔNG mutation** (để 2.4b).

- [x] `types/api.ts`: refactor `User extends PublicUser` (7-field base, zero-break — structural); thêm Phase 2 types: `Post`, `PostMedia`, `Comment`, `PublicUser`, enums `PostVisibility`/`MediaType`, list wrappers (`FeedResponse`/`PostListResponse`/`CommentListResponse`/`UserListResponse`), `LikeResponse`/`FollowResponse`, input types, `Presign{Request,Response}`.
- [x] **Envelope rule**: Phase 2 posts/comments trả **BARE** (KHÔNG wrap `{ post }`/`{ comment }` như Phase 1 users `{ user }`). DELETE → 204 → `Promise<void>`. List → `{ <items>, nextCursor }`.
- [x] `lib/queryKeys.ts`: factory tập trung (`feed/post/userPosts/comments/followers/following/user/me`), key hierarchical để 2.4b prefix-invalidate.
- [x] `api/`: 6 thin client (`posts/feed/comments/likes/follows/media`, object-export như Phase 1) + `upload-client.ts` (axios riêng presigned PUT) + `index.ts` barrel (import qua `@/api`).
- [x] `features/{feed,posts,comments}/hooks/`: read hooks `useFeed`/`useUserPosts`/`useComments` (`useInfiniteQuery`, cursor, `getNextPageParam: nextCursor ?? undefined`) + `usePost` (`useQuery`, `enabled` guard).

> **Comment list order**: **newest-first** (`createdAt` DESC) — comment mới nhất ở ĐẦU list, scroll xuống = comment cũ hơn (next page). `useCreateComment` optimistic **PREPEND** vào `pages[0]` (KHÔNG append cuối). Backend `comments.service` `orderBy [createdAt desc, id desc]`. (Đổi từ ASC/oldest-first ở 2.4b — quyết định UX: user thấy comment mình vừa gửi ngay không cần scroll.) Caption post (intrinsic) vẫn render ở header trên cùng, không nằm trong comment list.

> **Next 2.4b**: mutation hooks (`useLikePost`/`useFollow`/`useCreateComment`/`useCreatePost`…) + optimistic update + rollback (helper patch-post-across-caches) + UI (PostCard, FeedPage, Composer, profile grid). Giá trị client-side media validation chốt tại đây.

## Phase 2.5 — Follow button + Profile counts (public profile) — DONE

Profile thật cho MỌI user (self + other) qua 1 endpoint, Follow button optimistic, public route.

- [x] **1 endpoint** `GET /users/:username` trả `ProfileUser` (`types/api.ts`: `PublicUser` + `postsCount/followersCount/followingCount` + `isFollowing: boolean|null`). `PublicUser` GIỮ 7 field (vẫn là `post.author`/`comment.author`/list item — KHÔNG phình). `api/users.getByUsername` retype `ProfileResponse`.
- [x] `features/users/hooks/`: `useUserProfile` (`useQuery` + `select: res => res.user`, cache lưu envelope `{ user }` để follow patch được). `followMutation` engine (mirror `likeMutation`) → `useFollow`/`useUnfollow`. Optimistic toggle `isFollowing` + `followersCount ±1` (idempotent guard), rollback `onError`, **`invalidateQueries(user(username))` `onSettled`** để reconcile count authoritative (follow response chỉ `{ following }`, KHÔNG kèm count).
- [x] `components/profile/`: `FollowButton` (Follow coral / Following outline → hover Unfollow đỏ, disabled khi pending). `ProfileEditForm` extract khỏi page cũ (named export).
- [x] `pages/UserProfilePage` (merge từ `ProfilePage` đã xóa): `useParams().username`, `isSelf = me.username === username`. Self → "Edit profile" (onSaved: `updateUser` + invalidate `user(me)`); other → `FollowButton` (chỉ render khi `isFollowing !== null`). Grid reuse `PostsGrid username`. Empty state self có CTA, other không.
- [x] Routing (`App.tsx`): `/users/:username` → `UserProfilePage`; `/profile` → `<ProfileRedirect>` (đọc authStore → `Navigate /users/<me>`). Nav links GIỮ `/profile` (redirect lo). Author (avatar+@username) ở `PostCard`/`PostDetailView`/`CommentItem` → `<Link to=/users/:username>` (giải tech-debt 2.4b author chưa clickable).

> **isSelf detection**: dùng `me.username === username` (KHÔNG dựa `isFollowing === null` — null cũng là anonymous, nhưng route protected nên null ⇒ self; vẫn ưu tiên username compare cho rõ).
> **Follow scope**: mutation CHỈ patch cache `user(username)`. KHÔNG đụng feed → `post.isFollowingAuthor` + feed membership có thể stale tới refetch tự nhiên (chấp nhận, ngoài scope 2.5).
> **Counts authoritative**: stats header (`postsCount/...`) qua `formatNumber` (compact). `postsCount` từ backend đã mirror grid visibility — KHÔNG còn là loaded-count + "+" như 2.4c.

## Phase 3.1 — Multi-image carousel — DONE

Post từ 1 ảnh → carousel tối đa **5 ảnh**. Data model Phase 2 đã carousel-ready (`PostMedia[]` + `order`) → chỉ đổi BE `createPostSchema.media.max(1)→.max(5)`, KHÔNG migration.

- [x] **Composer state machine** (`PostComposerModal.tsx`): state đổi từ single → `images: ComposerImage[]` + `cropIndex` cursor + `ratio` lifted (shared). Step enum giữ `select→crop→caption→upload→done`; `crop` là 1 CropStage **re-keyed `key={image.id}`** chạy qua cursor (bắt buộc re-key để zoom/offset/preview reset sạch giữa ảnh). `goToCrop` vào ảnh chưa-crop đầu tiên; `handleCropped` advance tới ảnh chưa-crop kế hoặc → caption. Submit build `CroppedImage[]` theo array order.
- [x] **Shared aspect ratio (IG-style)**: chọn 1:1/4:5/1.91 MỘT lần ở ảnh đầu, `ratioLocked = images.some(i=>i.cropped)` khóa cho ảnh 2..N → slide carousel không nhảy height. `CropStage` ratio thành **controlled props** (`ratio`/`onRatioChange`/`ratioLocked`), bỏ internal `useState`.
- [x] **`ComposerImage`** (`composer/types.ts`): `{id, file, dimensions, isPassthrough, cropped: CroppedImage|null}` + `MAX_IMAGES=5`. `SelectStage` `<input multiple>` + drop-all, emit `onAdd`, cap 5 + message. `ImageStrip.tsx` (mới): thumbnail + X remove + ◀▶ reorder (swap neighbour), objectURL cache theo `id` (re-crop đổi blob mới revoke), revoke hết on unmount. Strip render ở Select + Caption (>1 ảnh).
- [x] **`useCreatePost`**: `CroppedImage` → `CroppedImage[]`; upload **tuần tự** (`for...of`, KHÔNG Promise.all) N presign+PUT; progress gộp `((i+filePct/100)/n)*100`; thêm `uploadIndex`/`uploadTotal` cho UploadStage label "Uploading k/N…". Giữ no-optimistic + onSuccess (seed `post(id)` + invalidate `userPosts(me)`, KHÔNG đụng feed).
- [x] **Render `PostCarousel.tsx`** (mới): `media.length<=1` → defer `PostMedia` (zero regression Phase 2). Nhiều ảnh: CSS scroll-snap (`snap-x snap-mandatory`, `scrollbar-hide`), active index qua `scrollLeft/clientWidth`, arrows `hidden md:grid`, dots, badge `Copy` top-right. Aspect từ `clampAspectRatio(media[0])`. Dùng ở `PostCard` (1 ảnh GIỮ `<Link>`, carousel KHÔNG Link — swipe/arrow không điều hướng; mở detail qua comment icon) + `PostDetailView`. `PostsGrid.GridItem` thêm badge `Copy` khi `media.length>1` (grid vẫn cover `media[0]`).

> **GIF/AVIF (passthrough) = single-image-only**: nếu selection có GIF/AVIF thì phải là ảnh DUY NHẤT (passthrough giữ framing gốc → không ép được shared ratio → vỡ height-stability). Chặn ở `SelectStage` (`currentHasPassthrough || (incomingPassthrough && (images.length>0 || valid.length>1))`).
> **Orphan S3 on retry** (known debt): 1 trong N PUT fail → các ảnh đã upload trước thành orphan (POST /posts chưa chạy). Retry re-upload TẤT CẢ (objectKey mới → thêm orphan). Chấp nhận — khớp posts.service "orphan check để Phase polish".
> **Caption-only**: composer vẫn yêu cầu ≥1 ảnh (parity Phase 2.4c); hook media-optional vẫn handle caption-only nếu gọi từ chỗ khác.

## Phase 3.3 — Nested comments / replies — DONE

Comment flat → IG-style nested (flatten 1 cấp) qua **split queries**. Backend tách `GET /posts/:id/comments` (root only + `repliesCount`) và `GET /comments/:id/replies` (lazy).

- [x] **Types**: `Comment` thêm `repliesCount: number`; `CommentListResponse` (`{ comments, nextCursor }`) **reuse cho cả root lẫn replies**. `queryKeys.replies(commentId) = ['comments', commentId, 'replies']`. `commentsApi.listReplies(commentId, cursor?)`.
- [x] **`lib/commentCache.ts`** (mirror `postCache.ts`, nhưng key exact KHÔNG cần predicate sweep): `bumpRepliesCount(qc, postId, rootId, ±1)` (clamp ≥0), `appendReply`/`removeReply` (replies cache), `removeRootComment` (comments cache), `snapshotCommentCaches`/`restoreCommentCaches` (comments(postId) + 1 replies(id)). `post.commentsCount` vẫn patch qua `postCache` (backend `_count.comments` đếm CẢ replies → mọi create/delete đều bump).
- [x] **`lib/parseMentions.tsx`**: regex `/(?<!\w)@([A-Za-z0-9._]+)/g` (charset khớp username backend; lookbehind chặn `email@gmail.com`), strip trailing `.`/`_`, → `<Link text-primary>` (KHÔNG có `text-coral`). Render `{parseMentions(content)}` trong span, KHÔNG dangerouslySetInnerHTML.
- [x] **Hooks**: `useReplies(commentId, enabled=true)` (infinite, chronological). `useCreateComment` refactor mutate var `{ content, parentId? }` — branch root (prepend) vs reply (append + bumpRepliesCount), cả 2 bump post.commentsCount. `useDeleteComment` (mutate `{ commentId, postId, parentId, repliesCount }`): reply → removeReply + repliesCount−1 + commentsCount−1; root → removeRootComment + commentsCount−(1+repliesCount) + onSuccess `removeQueries(replies(id))` (cascade). Optimistic + snapshot/rollback, KHÔNG invalidate list khi delete.
- [x] **Components**: `CommentList` lift `replyingTo` state + đổi infinite-scroll sentinel → nút "View more comments" (`fetchNextPage`). `CommentItem` refactor lớn: actions Reply (mọi comment, disable trên `temp-`) + Delete (chỉ `me.id===author.id`, đổi từ post-author); root + `repliesCount>0` → "View N replies"/"Hide replies" toggle `showReplies`; click Reply trên root → auto-expand. `RepliesList` (mới, indent `border-l pl-3`) lazy `useReplies` + "View more replies" + inline `CommentForm` ở cuối khi `replyingTo.rootCommentId === commentId`. `CommentForm` thêm `parentId`/`parentUsername`/`onClose`/`inputId`/`autoFocus` — reply mode prefill "@user " + chip; **main form gắn `inputId=COMMENT_INPUT_ID`, reply form dùng `autoFocus`** (tránh id collision). `CommentDeleteConfirmDialog` (mới) chỉ bật khi xóa root CÓ replies (cảnh báo cascade); còn lại delete instant.

> **Circular import có chủ ý** `CommentItem ↔ RepliesList` (item render RepliesList khi expand; RepliesList render item cho mỗi reply): an toàn vì binding đọc ở render-time + type-only import `ReplyTarget` (export từ `CommentItem`).
> **`text-coral` KHÔNG tồn tại** — coral = `--primary` → dùng `text-primary`.
> **post.commentsCount = tất cả comments + replies** (backend `_count.comments` không filter parentId). Reply create/delete cũng cập nhật nó.

## Phase 4.1 — Stories core (StoryBar data thật + composer slim + viewer) — DONE (code)

Stories ephemeral 24h: StoryBar wire data thật, composer slim (single media, force 9:16 ảnh / video ≤15s), viewer full-screen cơ bản. **Build slim mới — KHÔNG reuse skeleton `PostComposerModal`** (chỉ reuse code utilities).

- [x] **Data layer**: `types/api.ts` (`Story` — media phẳng + `isViewedByMe`, `StoryFeedItem` `{user, stories[], hasUnseenStory}`, `StoryFeedResponse {items}`, `UserStoriesResponse {stories}`, `CreateStoryInput`). `queryKeys.storiesFeed()`/`userStories(username)`. `api/stories.ts` (5 method: feed/listByUsername/create/view/remove) + barrel. `lib/storyCache.ts` (mirror `postCache`, nhưng 2 cache là **plain useQuery** KHÔNG infinite): `markStoryViewedInCaches` (flip isViewedByMe + recompute hasUnseenStory group), `removeStoryFromCaches` (drop story + drop group rỗng), `snapshot/restore`.
- [x] **Hooks** `features/stories/hooks/`: `useStoriesFeed` (useQuery, `select: r=>r.items`), `useUserStories(username, enabled)` (useQuery, `select: r=>r.stories`, enabled khi viewer mở), `useCreateStory` (mirror `useCreatePost` orchestration nhưng **single media**: image 1 PUT / video 2 PUT 90-10; no optimistic; onSuccess invalidate `userStories(me)` — feed loại self nên KHÔNG đụng), `useViewStory` (optimistic mark seen + rollback), `useDeleteStory` (optimistic remove + rollback).
- [x] **Stores**: `storyComposerStore` (clone `composerStore`: isOpen/open/close), `storyViewerStore` (`{isOpen, username, open(username), close}`).
- [x] **Components** `components/story/`: `StoryBar` (EXTRACT khỏi `FeedPage`; wire `useStoriesFeed`; giữ scroll-arrows logic; "Your story" → composer, ring → viewer; skeleton khi loading), `StoryRingItem` (Avatar + ring gradient coral khi `hasUnseen` / muted khi seen), `StoryViewer` (**hand-rolled `fixed inset-0`** KHÔNG Radix — tự lock body scroll + ESC; bắt đầu first-unseen; tap trái/phải prev/next; timer 5s ảnh / duration video + `onEnded` backup; video play-with-sound fallback muted; owner Delete; mark seen mỗi story; segment indicators position-only, timed-fill để 4.2), `StoryComposer` (slim Dialog: select→crop|video→upload→done, KHÔNG caption) + `SelectStoryStage` (1 media; ảnh CROPPABLE only jpeg/png/webp + video mp4 ≤50MB ≤15s; GIF/AVIF reject) + `StoryCropStage` (reuse `cropImage` utilities, **ratio LOCKED 9:16 = 0.5625, no picker**). Reuse trực tiếp `composer/VideoStage` (poster extract). Mount `<StoryComposer/>` + `<StoryViewer/>` ở `AppLayout` (sau PostComposerModal).

> **Viewer hand-rolled (không Radix Dialog)**: để 4.2 gắn gesture (hold-pause/swipe-down) không vướng focus-trap. Đổi lại tự `document.body.style.overflow='hidden'` + ESC listener khi mount.
> **Composer slim ≠ PostComposerModal**: story single-media, force 9:16, no caption/carousel/ratio-picker. Reuse: `useCreatePost` (mẫu orchestration), `cropImage` utilities, `getVideoMetadata`/`extractVideoThumbnail`, `VideoStage`, Dialog shell.
> **Ảnh croppable-only**: GIF/AVIF passthrough không ép được 9:16 (cùng lý do carousel chặn passthrough) → reject ở `SelectStoryStage`.
> **Video 15s gate ở client** (`SelectStoryStage` sau `getVideoMetadata`); backend trust client. Sound: viewer thử play có tiếng (open click = gesture), fail → muted autoplay; unmute toggle để 4.2.
> **storyCache key plain (KHÔNG infinite)**: storiesFeed/userStories là `useQuery` thường → patch trực tiếp object `{items}`/`{stories}`, KHÔNG `InfiniteData` như postCache.

## Phase 4.3a — Story overlays builder (TEXT + EMOJI) — DONE

Stories editable: kéo-thả overlay TEXT + EMOJI (data-driven `StoryItem`, render từ DB — KHÔNG burn-in canvas). **Cả image + video** đều qua edit step (video bg = `<video>` paused first frame seek 0.1s, `object-contain` letterbox — match viewer). Chỉ drag (scale/rotate multi-touch + MENTION/STICKER/TAG → 4.3b).

- [x] **Dep ngoại lệ**: `@emoji-mart/react` + `@emoji-mart/data` + `emoji-mart` (~50KB) — **ngoại lệ có chủ đích** quy tắc "KHÔNG dep mới"; UX picker justify. emoji-mart **ship types sẵn** (KHÔNG cần `.d.ts`).
- [x] **Types** (`types/api.ts`): `StoryItemType = 'TEXT'|'EMOJI'` (renderable subset; BE enum full-5), `StoryItem` (discriminated `{id,x,y,scale,rotation,type,payload}`), `StoryItemInput` (no id). `Story.items: StoryItem[]`, `CreateStoryInput.items?`.
- [x] **Overlay primitives** (`components/story/`): `StoryOverlay` (reuse editor+viewer; `left x*100% top y*100% translate(-50%,-50%) scale rotate`; `editable`→`pointer-events-auto touch-none`+drag handlers, viewer→`pointer-events-none`; TEXT bold white+shadow+bg-black/30, EMOJI text-6xl; **selected ring trên inner `inline-block`** (hug content sát text) + `max-w-[80%]` ở outer absolute (giải circular % — outer shrink theo inner)). `StoryOverlayLayer` (viewer read-only, `pointer-events-none`, `null` khi rỗng → 4.1/4.2 backward-compat). `TrashZone` (bottom-center `pointer-events-none`, visible khi drag, highlight `scale-125 bg-red-500` khi near). `AddTextOverlay` + `EmojiPickerOverlay` (**inline `absolute inset-0 z-50`, KHÔNG nested Radix Dialog** — tránh focus-trap; ESC/backdrop cancel; empty submit = cancel).
- [x] **`hooks/useOverlayDrag.ts`**: **1 hook** owns active drag (1 pointer/lần) → `getHandlers(item)` cho mỗi overlay (gọi hook trong `items.map` sẽ **vỡ rules-of-hooks** → KHÔNG làm). Reuse **CropStage `setPointerCapture` idiom** + `dragRef` incremental delta; normalize px→0-1 theo `contentRef.getBoundingClientRect()`. `pointerup`: move <5px = **tap** (toggle select) / ≥5px = drag commit. Trash hit tính từ **ref final position** (`<0.12` normalized) — KHÔNG đọc state (tránh stale).
- [x] **`StoryEditStage.tsx`** (image + video): layout **mirror viewer** (`max-w-md mx-auto` + `h-20` top + `h-20` bottom chrome + `flex-1` content). Props `media: StoryMediaPayload` (discriminate `contentType==='video/mp4'`); bg = `URL.createObjectURL(media.blob)` (revoke unmount) → image `<img object-cover>` / video `<video object-contain bg-black>` paused, `onLoadedMetadata` seek `currentTime=0.1` (match poster, no autoplay). State `items`(temp-id)/`selectedId`/`draggingId`/`showAddText`/`showEmoji`. Add text/emoji → push center `x:0.5 y:0.5 scale:1 rotation:0` + select. Drag end: `inTrash`→filter / else→update clamp. Tap empty (content `onPointerDown`)→deselect. `Share`→strip temp id (`map (it):StoryItemInput` giữ literal discriminant)→`onComplete`. Top chrome: **X(close composer)/Back/Share**.
- [x] **`StoryComposer.tsx`**: step `edit` cho **cả 2 flow** — image `crop→edit→upload`, video `video→edit→upload` (cùng `StoryEditStage`). `editingMedia: StoryMediaPayload`; edit `onBack` conditional (video→`video` / image→`crop`). DialogContent **full-bleed trên edit** (drop `sm:` caps + `bg-black` + **no title bar** + `showClose={false}` + `onEscapeKeyDown preventDefault`) → editor content zone **khít viewer** (coord consistency). `submit(media, items?)` + `pending {media,items}` retry. **Labels**: StoryCropStage + VideoStage cuối = `Next` (→edit); editor cuối = `Share` (→upload+post).
- [x] **`StoryViewer.tsx`**: restructure **flex-col chrome zones** (top `z-30 h-20` progress+header / `flex-1` content media+overlay+gesture-z-10 / bottom `h-20` reply-placeholder) + `<StoryOverlayLayer items={currentStory.items}>`. **Giữ nguyên** gesture/progress/mute/swipe-translateY/cross-user/`initializedRef`.
- [x] **`useCreateStory.ts`**: mutate var `{media, items?}`; `items` vào `CreateStoryInput` cả 2 nhánh (video→`undefined`→BE default `[]`).

> **Coord consistency (CRITICAL)**: overlay normalized 0-1 theo `flex-1` content zone; ảnh `object-cover`. Khớp editor↔viewer **chỉ khi 2 content zone cùng aspect** → ép **same layout** (`max-w-md` + `h-20`/`h-20` chrome) + edit **full-bleed no-title-bar** (content zone editor == viewer). Mobile cả 2 full-screen → **exact**; desktop cùng `max-w-md` width → khớp (lệch nhẹ nếu viewport height khác).
> **1 hook useOverlayDrag (không per-item)** — `getHandlers(item)` đóng over item, active drag ở 1 ref. KHÔNG reuse `useStoryGestures` (đó là viewer-nav: hold/swipe/tap-thirds — concern khác).
> **AddText/Emoji ESC**: composer `onEscapeKeyDown preventDefault` trên edit (Radix KHÔNG đóng composer) + overlay window-ESC tự cancel. Edit step `showClose={false}` (X của editor tự lo, tránh va Next + dark-on-black).
> **Editor temp-id**: overlay nội bộ là `StoryItem` (temp `tmp-N` id cho key/select/drag); `onComplete` strip id → `StoryItemInput[]`.
> **`text-coral` KHÔNG tồn tại** — overlay TEXT dùng `text-white`; coral primary cho Next button (default Button).

## Phase 4.4 — Stories archive + cron + profile entry + view count/viewers — DONE

Đóng Phase 4: archive page + cron (BE), story ring trên profile avatar (entry point thứ 2 ngoài StoryBar), view count badge + viewers list cho owner.

- [x] **Data layer**: `types/api.ts` (`Story.viewCount: number|null` owner-only, `ProfileUser.hasActiveStory`, `ArchivedStoriesResponse`, `ViewerEntry`/`ViewersListResponse`). `api/stories` (`listArchive(cursor?)` → `/stories/archive`, `listViewers(id, cursor?)` → `/stories/:id/views`). `queryKeys.archivedStories()`/`storyViewers(id)`. Hooks `useArchivedStories(enabled)` + `useStoryViewers(storyId, enabled)` (cả 2 **useInfiniteQuery** cursor — KHÁC 4.1 plain useQuery).
- [x] **StoryViewer 3-mode (Option 3 — branch, KHÔNG component riêng)**: `storyViewerStore` extend `mode: 'feed'|'single-user'|'archive'` + `startStoryId` + object-form `open({ mode, startUsername?, startStoryId? })` (2 call site cũ StoryBar→`feed`/composer "View story"→`single-user` update). Viewer: 3 data source theo mode (`useStoriesFeed`/`useUserStories`/`useArchivedStories`, archive queue = `pages.flatMap(p=>p.stories)`), `canCrossUserAdvance = mode==='feed' && isUnseenFlow`, `shouldMarkSeen = mode!=='archive'` (archived = đã-seen + BE reject), `isOwner = mode==='archive' || me.id===authorId`, init-effect branch theo mode (archive locate `startStoryId`). Giữ nguyên gesture/progress/mute/swipe/4.3a overlay.
- [x] **View count + viewers**: badge `👁 N views` (Eye) bottom-left content zone z-30 (cạnh mute), render khi `isOwner && viewCount !== null`. Click → `StoryViewersModal` (**Radix `ui/dialog`**, portal trên viewer z-50, `max-w-md` + list `max-h-[70vh]` scroll, infinite-scroll sentinel, avatar+username+`formatRelativeTime`, empty "No viewers yet"; **click viewer row đóng CẢ viewer** `storyViewerStore.close()` + modal — KHÔNG chỉ modal, tránh viewer z-50 che ProfilePage sau navigate; pattern header Link 4.2). **Pause khi modal mở**: `isPaused = gestures.isPaused || isViewersModalOpen` → truyền cho StoryProgressBars + video effect (KHÔNG sửa `useStoryGestures`). **ESC guard**: window-ESC listener check `modalOpenRef.current` → modal mở thì ESC đóng modal (Radix) KHÔNG đóng viewer.
- [x] **Archive page + profile ring**: `pages/ArchivePage.tsx` (`/me/stories/archive`, `mx-auto max-w-2xl`, grid `grid-cols-3 sm:4 md:5 gap-1` cell `aspect-[9/16]` thumbnail [video→`thumbnailUrl`, image→`mediaUrl`] + Play badge, click → `openViewer({ mode:'archive', startStoryId })`, EmptyState + skeleton + infinite-scroll). Route trong `App.tsx` dưới ProtectedRoute>AppLayout. `UserProfilePage`: avatar (inline span, KHÔNG `Avatar` component) wrap ring gradient coral khi `hasActiveStory` → button mở `single-user` viewer; self thêm nút "Archive" → navigate.
- [x] **Delete archive**: `storyCache.removeStoryFromCaches` + snapshot/restore mở rộng **patch cả archive infinite cache** (`InfiniteData<ArchivedStoriesResponse>`, shape KHÁC plain feed/userStories) → delete trong archive viewer drop cell khỏi grid; `useDeleteStory` thêm `cancelQueries(archivedStories())`.

> **Profile ring → single-user mode (KHÔNG feed)**: tap avatar profile chỉ xem story user đó (no cross-user) — khác StoryBar ring (feed/cross-user). Privacy: `hasActiveStory` đã gate ở BE (private + non-follower → false → KHÔNG ring).
> **Archive viewer unreachable qua feed/userStories** (active-only): bắt buộc nguồn thứ 3 `useArchivedStories`. Mode='archive' ⇒ no mark-seen (BE `markStoryViewed` reject archived), no cross-user, isOwner luôn true ⇒ viewCount badge + viewers list dùng được trong archive viewer.
> **viewCount badge render khi `!== null`** (KHÔNG `&& viewCount` — 0 views vẫn hiện "0 views", click → "No viewers yet"). Owner-gate thật ở BE (non-owner = null).
> **`text-coral`/coral ring** — ring gradient reuse pattern `StoryRingItem` (`bg-gradient-to-tr from-primary to-[oklch(0.7_0.17_80)]`).

## Phase 5.1 — Messaging Foundation (list + detail, optimistic send, polling) — DONE

DM/group chat foundation: 1 route `/messages` + `/messages/:id` → responsive 2-pane (desktop) / stack (mobile). **KHÔNG Socket.io** (polling 5s đứng thay, defer 5.2), **KHÔNG image/video message** (defer 5.4). `tsc -b` + `vite build` 0 lỗi (2030 modules).

- [x] **Data layer**: `types/api.ts` (`ConversationType`/`MessageContentType` unions, `Participant {user,isAdmin}`, `Message`, `Conversation {…, lastMessageAt, participants, lastMessage}`, inputs + named-key wrappers `ConversationListResponse`/`MessagesListResponse`). `api/conversations.ts` (6 method) + barrel. `queryKeys` (`conversations`/`conversation(id)`/`messages(id)`). `lib/messageCache.ts` (mirror `commentCache`: `insertOptimisticMessage` prepend page[0] / `swapTempMessage` / `snapshot`+`restore`). `lib/messageBurst.ts` (pure `groupMessagesByBurst`, 2-phút threshold, oldest-first input).
- [x] **Hooks** `features/messaging/hooks/`: `useConversations`/`useMessages` (`useInfiniteQuery`, cursor; messages thêm **`refetchInterval: 5000`** — v5 tự pause khi tab background + refetch on focus, KHÔNG cần code tay), `useConversation` (`useQuery` enabled), `useSendMessage` (optimistic temp-id mirror `useCreateComment`: onMutate cancel+snapshot+insert temp / onError restore / onSuccess swap temp→real fallback invalidate + invalidate `conversations()` để re-sort+preview), `useStartDirectConversation` (mutate `createDirect` → onSuccess seed cache + invalidate + `navigate('/messages/'+id)`).
- [x] **UI** `components/messaging/`: `ConversationList` (infinite + `useInfiniteScroll` sentinel + skeleton + EmptyState), `ConversationListItem` (Avatar + name + preview CSS-truncate + `formatRelativeTime(lastMessageAt)`), `ConversationDetail` (header avatar+name+mobile back, `key={id}` remount khi switch), `MessageThread` (flatten newest-first → `[...].reverse()` oldest-first → `groupMessagesByBurst` → `BurstGroup`; scroll-to-bottom on new msg + restore-position on prepend; top sentinel load older), `MessageBubble` (own right/primary, other left/muted, temp `opacity-60`+spinner), `MessageInput` (auto-grow textarea, Enter send / Shift+Enter newline, disabled pending), `EmptyConversationState` (desktop placeholder). `pages/MessagesPage` (`useParams().id` + `useIsDesktop`; desktop `w-80` list aside + detail/empty, mobile id?detail:list). `features/messaging/conversationDisplay.ts` (DIRECT → other participant / GROUP → name+avatar).
- [x] **Wiring**: `App.tsx` 2 route; `Sidebar` wire entry "Messages" có sẵn (`to:"/messages"`); `BottomNav` thêm Messages (thay placeholder Notifications); `UserProfilePage` nút **Message** cạnh FollowButton (non-self, `useStartDirectConversation`, disabled pending — guard double-click race cùng `directKey` upsert BE).

> **Newest-first store / reverse render (D4)**: cache giữ newest-first (cursor BE), `MessageThread` `[...flat].reverse()` → oldest top/newest bottom. Optimistic temp prepend vào `pages[0].messages[0]` (newest pos) ⇒ sau reverse = đáy = đúng chỗ chat.
> **Scroll preserve on prepend**: `useLayoutEffect` — `loadingOlder` ref true (set lúc top-sentinel intersect, capture `scrollHeight` trước fetch) ⇒ restore `scrollTop = scrollHeight - prevScrollHeight` (KHÔNG nhảy); else nếu `newestId` đổi ⇒ scroll bottom (new msg / initial). Phân biệt prepend (older, newestId KHÔNG đổi) vs append (new, newestId đổi).
> **Responsive md (768) qua `useIsDesktop`** (D3 — KHÔNG breakpoint riêng): desktop = 2-pane conditional render, mobile = single pane theo `id`. Layout chat fill `main` (`flex-1 overflow-y-auto`) bằng `h-full` + internal scroll zones (`flex h-full flex-col` → header shrink-0 / thread `flex-1 min-h-0 overflow-y-auto` / input shrink-0).
> **Optimistic = useCreateComment branch** (KHÔNG useCreatePost): message có temp-id reconcilable (swap in place) ≠ post (id/url thật chỉ sau server). Temp `temp-${crypto.randomUUID()}`, detect `id.startsWith('temp-')` → disable/spinner.
> **Burst grouping pure render-time**: `groupMessagesByBurst` chạy mỗi render trên reversed array; temp message group tự nhiên (mang `senderId`+`createdAt`). KHÔNG state.
> **Polling tab-inactive**: KHÔNG handle tay — TanStack v5 `refetchInterval` mặc định `refetchIntervalInBackground:false` ⇒ pause khi tab ẩn, refetch on focus.

## Phase 5.2 — Messaging Realtime (Socket.io) — DONE

Thay polling 5s bằng Socket.io. 4 feature realtime: **message:new** (nhận tin nhắn), **typing**, **presence** (online + last-seen), **read receipts**. **Send vẫn REST** (optimistic 5.1 nguyên vẹn — socket chỉ receive-only cho message). `tsc -b` + `vite build` 0 lỗi (2068 modules, +38).

- [x] **Dep + singleton**: `socket.io-client@4.8` (types built-in). `lib/socket.ts` **singleton** (mirror `apiClient`): `connectSocket()`/`disconnectSocket()`/`getSocket()`. **`auth` = callback** `(cb)=>cb({token: authStore.accessToken})` ⇒ mỗi (re)connect đọc token TƯƠI từ store (axios interceptor giữ token fresh) → **token expiry mid-connection tự xử lý trên reconnect, KHÔNG cần refresh path riêng**. `transports:['websocket']`.
- [x] **Stores (Zustand, KHÔNG Context)**: `socketStore` (status idle/connecting/connected/reconnecting/disconnected), `presenceStore` (`online: Record<userId,true>` + `lastSeen: Record<userId,iso>`; `setSnapshot`/`markOnline`/`markOffline`/`reset`), `typingStore` (`byConversation: Record<convId, Record<userId, username>>`; `setTyping`/`clearTyping`/`clearConversation`).
- [x] **Cache patch (D5, KHÔNG invalidate-on-send)**: `lib/conversationCache.ts` (NEW) — `patchConversationOnNewMessage` (update lastMessage/lastMessageAt + **move-to-top** infinite list; fallback invalidate nếu convo chưa trong cache) + `patchReadReceipt` (set participant.lastReadMessageId trên `conversation(id)` cache). `messageCache.ts` thêm `insertIncomingMessage` (**dedup 3 nhánh**: id đã có→no-op / temp pending cùng sender+content→replace-in-place tránh duplicate khi socket echo về trước REST response / else prepend) + `messageExists`. `useSendMessage.onSuccess`: swap temp→real, chỉ invalidate nếu `!swapped && !messageExists`, rồi `patchConversationOnNewMessage` (idempotent với socket echo, hoạt động cả khi socket down).
- [x] **Hooks** `features/messaging/hooks/`: `useSocketConnection` (lifecycle gated `isAuthenticated`; status→socketStore; **`socket.io.on('reconnect')`→`invalidateQueries(['conversations'])`** = catch-up thay polling vì Socket.io KHÔNG replay missed message; reset presence/typing on logout), `useGlobalSocketEvents` (bind presence + message:new → `insertIncomingMessage` + `patchConversationOnNewMessage`; re-bind theo `status` cho socket instance mới sau re-login), `useConversationSocket(convId)` (per-open-thread: emit `conversation:join` + `message:read` on mount; bind `typing:user` [+ TTL timer 4s per typist = backstop nếu mất stop] + `read-receipt:update` + `message:new`[incoming non-own → re-emit `message:read`]; cleanup emit `conversation:leave`; **`status` dep ⇒ rejoin room sau reconnect** vì server drop room on disconnect), `useTypingEmit(convId)` (`start` **heartbeat re-emit `typing:start` mỗi 2.5s** trong lúc gõ — PHẢI < receiver TTL 4s, nếu không indicator hết hạn giữa chừng & không hiện lại; + trailing stop 3s idle; `stop` ngay khi send/blur/unmount). `useMessages` **bỏ `refetchInterval`** (chỉ chỗ duy nhất). Mount `useSocketConnection`+`useGlobalSocketEvents` ở **`AppLayout`** (authed shell, cạnh StoryViewer).
- [x] **UI**: `Avatar` thêm `online?` → **wrapper `relative` + dot sibling NGOÀI vòng `overflow-hidden`** (không bị clip), green + `ring-background`. `conversationDisplay` thêm `otherUserId?` (DIRECT). `ConversationListItem` green dot khi `presenceStore.online[otherUserId]`. `ConversationDetail` `useConversationSocket` + header subtitle (typing > presence: "X is typing…" / "Active now" / "Active 5m") + dot + truyền `otherReadMessageId` xuống thread. `MessageThread` tính **`seenMessageId` POSITIONAL** (refinement: cuid KHÔNG sort-được theo thời gian ⇒ KHÔNG so `id >=`; tìm index của `otherReadMessageId` trong mảng đã-reverse, lấy own-message mới nhất ≤ index đó) → `MessageBubble showSeen` render 1 chữ "Seen" (DIRECT only; GROUP → null, no error). `MessageInput` `start` onChange + `stop` onSend/onBlur.

> **Read-receipt POSITIONAL (CRITICAL)**: cuid không monotonic theo thời gian ⇒ so `lastReadMessageId >= message.id` lexical là SAI. `MessageThread` có sẵn mảng messages đã-sort (oldest→newest) ⇒ tính index, render "Seen" dưới own-message mới nhất tại-hoặc-trước read cursor (IG behaviour). `MessageBubble` chỉ nhận prop `showSeen`.
> **Dedup self-echo (race)**: broadcast message:new chạm cả sender (multi-tab). Cùng tab: socket echo có thể về TRƯỚC REST response (temp còn trên màn hình) ⇒ `insertIncomingMessage` replace temp cùng sender+content thay vì prepend (tránh duplicate); `onSuccess` swap miss → check `messageExists` thay vì invalidate mù.
> **Reconnect safety net**: Socket.io reconnect default (Infinity, delay 1s→5s) self-healing NHƯNG KHÔNG replay message miss lúc disconnect ⇒ BẮT BUỘC `invalidateQueries(['conversations'])` on `reconnect` (prefix match cả list + conversation(id) + messages(id)). Đây là điều kiện để "replace polling hoàn toàn" an toàn.
> **Presence flicker / multi-tab**: ref-count server-side, offline debounce 5s (refresh = disconnect→reconnect <5s ⇒ cancel offline). Client `presenceStore` chỉ patch theo event.
> **Mark-on-open (D4)**: emit `message:read` lúc mở thread + mỗi incoming non-own khi đang mở. Read receipt **DIRECT only** (GROUP defer). **Unread badge count defer** (Phase polish) — 5.2 chỉ move-to-top + preview, KHÔNG đếm unread.

### Phase 5.2 follow-up — browser-verify fixes (4 issue)

- **T7 failed + retry (offline message)**: `useSendMessage.onError` KHÔNG rollback — `markMessageFailed` set `Message.failed=true` (client-only flag), giữ bubble trên màn hình. `MessageBubble` failed → `ring-destructive` + nút "Failed — tap to retry" → `onRetry(message)`. Retry = `useSendMessage` mutate `{content, retryTempId}` → `onMutate` branch `retryTempId` gọi `clearMessageFailed` (về pending) thay vì insert mới; success swap, fail re-mark. `MessageThread` own `useSendMessage` cho `onRetry` (instance thứ 2, cùng cache OK). Bỏ `snapshotMessages`/`restoreMessages` (orphan).
- **T5 hide Seen on reply (deviate IG)**: `MessageThread.seenMessageId` — sau khi tìm `readIndex`, check `messages.slice(readIndex+1).some(m=>m.senderId!==meId)` (recipient đã reply sau khi đọc) → ẩn Seen (null). DIRECT only nên `senderId!==meId` = recipient. IG giữ Seen vĩnh viễn; ta ẩn khi có reply.
- **Last-seen (T1)**: `presence:snapshot` giờ `{online, lastSeen}`; `presenceStore.setSnapshot({online,lastSeen})` merge lastSeen. `ConversationDetail` "Active {rel} ago" (rel==='now' → "Active now", tránh "now ago").
> **⚠️ Liên quan typing-không-chạy**: root cause ở BACKEND (listener-order, xem backend/CLAUDE.md), KHÔNG phải FE wiring. FE `useConversationSocket` emit `conversation:join` ngay khi mount/connect là đúng — chỉ cần server gắn listener trước await.

### Phase 5.2 UX polish — typing-in-thread + date separators + header cleanup

- **Typing indicator → đáy `MessageThread`** (rời khỏi header). Component `TypingIndicator.tsx` (text "X is typing" + 3 dots animate, **no avatar**; keyframe `typing-dot` trong `index.css` cạnh `story-progress`, delay inline 0/200/400ms). `MessageThread` subscribe `useTypingStore` + filter `meId` (chuyển từ ConversationDetail sang). Auto-scroll giữ indicator trong tầm nhìn nếu user near-bottom (<80px), KHÔNG yank khi đang đọc history.
- **Header subtitle = presence ONLY** (Q3): `ConversationDetail` bỏ typing logic + `useTypingStore` import + `formatTyping`; `subtitle = Active now / Active {rel} ago / null`.
- **Date separators** (`DateSeparator.tsx` + `format.ts: formatDateSeparator/isSameDay`): chèn giữa bursts khi **cross-day HOẶC gap >1h same-day** (`shouldShowSeparator(prev,cur)` trong MessageThread; first burst luôn có anchor). Format local 24h, English: today→`14:07` / `Yesterday 14:07` / `Mon 14:07` (≤6 ngày) / `Jun 3 14:07` / `Jun 3, 2024 14:07`. **Consolidate**: bỏ per-burst timestamp (`formatRelativeTime(burst.lastAt)`) khỏi `BurstGroup` — date separator là nguồn thời gian duy nhất trong thread. `formatRelativeTime` GIỮ (còn dùng ConversationListItem + ConversationDetail presence).

## Phase 5.3a — Message Reactions — DONE

Long-press (mobile) / hover (desktop) → 7-emoji quick picker; aggregate chips "👍 3  ❤️ 1" dưới bubble; optimistic + socket realtime. `tsc -b` + `vite build` 0 lỗi (2077 modules, +9).

- [x] **shadcn Popover** (`npx shadcn add popover`) — `ui/popover.tsx` từ `radix-ui` umbrella (đã cài), style `radix-nova`, Tailwind v4/oklch ready (token `--popover` đã có sẵn ở 1C). Exports `Popover/PopoverAnchor/PopoverTrigger/PopoverContent`. **KHÔNG cần adapt tay**.
- [x] **Data layer**: `lib/reactions.ts` (**SOURCE OF TRUTH** `REACTION_EMOJIS` 7 emoji — backend copy byte-for-byte; `groupReactionsByEmoji(reactions, meId) → [{emoji,count,reactedByMe}]` first-seen order; `myReaction(reactions, meId)` cho toggle). `types/api.ts`: `MessageReaction {userId,emoji}` + `Message.reactions: MessageReaction[]` (⚠️ optimistic Message ở `useSendMessage` phải thêm `reactions: []`) + socket `MessageReactionPayload {conversationId,messageId,userId,emoji:string|null}`. `api/messages.ts` (NEW `messagesApi.reactToMessage/removeReaction` → `/messages/:id/reactions`, parity backend module split) + barrel.
- [x] **`hooks/useLongPress.ts`** (NEW generic): pointerdown → `setTimeout(500ms)` → cb; move >10px cancel (KHÔNG xung đột scroll); **bỏ qua `pointerType==='mouse'`** (desktop dùng hover button). KHÔNG reuse `useStoryGestures` (viewer-nav, concern khác).
- [x] **`features/messaging/hooks/useReactToMessage.ts`** (NEW): mutate `{messageId, emoji|null}` (null=remove → `removeReaction`). `onMutate` cancel + snapshot full InfiniteData + optimistic `patchMessageReactions` (filter userId của mình → append emoji mới nếu không phải remove). `onError` restore snapshot. `onSuccess` reconcile = replace bằng `data.reactions` server (idempotent với socket echo). Expose **`toggle(messageId, currentMyEmoji, tappedEmoji)`**: tap emoji đang có = remove, khác = set/replace.
- [x] **`lib/messageCache.ts`**: `patchMessageReactions(qc, convId, messageId, updater)` — map pages→messages→replace `reactions`. **Mirror `setMessageFailed`** (same-reference-when-unchanged). `useGlobalSocketEvents` thêm listener **`message:reaction`** (delta: filter userId → append emoji, emoji=null xóa) → patch thread cache (chạy cả khi thread đóng, giữ warm cache đúng). KHÔNG đụng conversationCache (reaction không đổi list preview).
- [x] **Components**: `ReactionPicker.tsx` (NEW, presentational hàng 7 emoji trong `PopoverContent`, highlight `currentEmoji`). `ReactionChips.tsx` (NEW, chips compact dưới bubble `-mt-1`, own-reacted highlight `border-primary bg-primary/15`, click toggle; rỗng → null). `MessageBubble.tsx` (refactor lớn): pull `meId` **local** (convention, KHÔNG prop-drill); `useReactToMessage(message.conversationId)` (message có sẵn conversationId — KHÔNG prop mới); controlled `<Popover open>` + `<PopoverAnchor asChild>`=bubble + `<PopoverTrigger>` = hover SmilePlus (`opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100`) + long-press set open; **`canReact = !id.startsWith('temp-')`** (disable trigger + ẩn chips trên temp/failed — chưa có real id); layout dọc: bubble → ReactionChips → status (Seen/Failed). `MessageThread` **KHÔNG đổi** (đã truyền `message`; meId local trong bubble).

> **Toggle 1 nguồn cho cả picker lẫn chip**: cả `ReactionPicker.onSelect` và `ReactionChips.onToggle` đều gọi `toggle(message.id, myEmoji, emoji)` → tap lại emoji đang có = remove, khác = replace. Nhất quán + intuitive.
> **Optimistic key theo meId** (1 reaction/user): patch = "xóa entry của mình rồi thêm mới" ⇒ rapid 2-emoji clicks settle về click cuối; out-of-order server response = last-write-wins (flicker nhẹ chấp nhận).
> **`canReact` chặn temp/failed**: react cần real id; optimistic/failed message (`temp-` id) ẩn trigger + chips. Optimistic Message ở useSendMessage thêm `reactions: []`.
> **GROUP "Seen by N" → 5.3b** (FE-only): tách checkpoint sau, backend đã đủ lastReadMessageId.

## Phase 5.4a — Media Messages (Image + Video) — DONE

1 message mang text caption AND/OR 1–10 media (ảnh + video **trộn được**); client resize thumbnail + upload gốc qua presign; grid IG-style trong bubble + lightbox fullscreen; optimistic per-item progress + retry. `tsc -b` + `vite build` 0 lỗi (2086 modules, +9). 4 decision FINAL: D1 IG-adaptive grid · D2 allow-mix · D3 parallel pool-3 · D4 Rich model.

- [x] **Types** (`types/api.ts`): `MessageMedia {id,type,order,url,thumbnailUrl,width,height,duration}` + **client-only optional** `localUrl`/`uploadProgress`/`uploadStatus` (mirror `Message.failed` — server không gửi). `Message.media: MessageMedia[]` (required, [] cho text). `MessageMediaInput` (client→server, KÈM objectKey/thumbnailObjectKey). `SendMessageInput {content?, media?}` (bỏ `contentType:'TEXT'` — server derive).
- [x] **Lib helpers**: `imageResize.ts` (`makeImageThumbnail` Canvas ≤512px JPEG q0.72, fallback original blob khi decode fail — vd AVIF). `uploadPool.ts` (`runPool(items, worker, 3)` ordered, no p-limit). `messagePreview.ts` (`formatMessagePreview` → caption / `📷 Photo` / `🎥 Video` / `📎 N attachments`). `messageCache.patchMessageMediaProgress(qc,convId,tempId,order,progress,status)` (mirror patchMessageReactions, same-ref-when-unchanged, match by `order`).
- [x] **`features/messaging/mediaUpload.ts`** (NEW, plain module KHÔNG hook): `prepareAttachment(file)` (image → `getImageDimensions` + `makeImageThumbnail`, previewUrl=objectURL gốc; video → `getVideoMetadata`+`extractVideoThumbnail` reuse `lib/video.ts`, previewUrl=objectURL poster) → `PreparedAttachment`. `uploadAttachments(atts, onItem)` = **`runPool` cap-3** (D3), mỗi item 2 PUT (gốc 0–90% + thumbnail 90–100%) → `MessageMediaInput`; item xong set `a.uploaded` (resume); fail → `onItem failed` + re-throw. **Pending stash** = Map module keyed temp-id (`setPendingAttachments`/`getPendingAttachments`/`clearPendingAttachments` revoke previewUrl) — File/Blob KHÔNG serialize được vào cache.
- [x] **`useSendMessage` rewrite**: vars `{tempId, content?, isRetry?}` (caller sinh `temp-…`; retry reuse id + `isRetry`). `onMutate`: build optimistic media từ stash (localUrl + `uploadStatus:'uploading'`), derive contentType, `insertOptimisticMessage` (+ `reactions:[]`); retry → `clearMessageFailed` + reset item chưa-`uploaded` về uploading. `mutationFn`: `uploadAttachments` (patch progress qua cache) → `sendMessage({content, media})`. `onSuccess`: `swapTempMessage` + `clearPendingAttachments` (revoke). `onError`: `markMessageFailed` (KHÔNG rollback). `MessageThread.onRetry` → `{tempId, isRetry:true}` (text + media, resume).
- [x] **Components** (`components/messaging/`): `MessageMediaGrid` (IG D1: 1→aspect-preserve, 2→2 vuông, 3→1 cao + 2 stacked, 4→2×2, 5+→2×2 + `+N` overlay ô cuối; `gap-0.5` seam). `MediaCell` (type-aware: img thumbnail / video poster + play badge + duration; **upload overlay** spinner+`%` / failed AlertCircle; **open-gate**: chỉ mở lightbox khi `!uploadStatus` = message thật). `MediaLightbox` (NEW, hand-rolled `fixed inset-0 z-[60]`, body-scroll lock + ESC + ←/→ + swipe, img object-contain / video controls; mount **AppLayout** cạnh StoryViewer) + `mediaLightboxStore` (open/setIndex/close). `MessageBubble` render `MessageMediaGrid` TRÊN caption (anchor wrap cả 2 cho long-press/picker); spinner text chỉ khi `!hasMedia`. `MessageInput` rewrite (nút attach `ImagePlus` + hidden `<input multiple accept image/*,video/*>` + preview strip thumbnail/X + validate `validateAttachment` ≤10/size/MIME + `preparing` state → `prepareAttachment` all → `setPendingAttachments` → mutate). `ConversationListItem` preview qua `formatMessagePreview`.

> **Optimistic media + pending stash (CRITICAL)**: query cache chỉ giữ serializable ⇒ `PreparedAttachment[]` (File/Blob/thumbnail) sống ở Map module keyed `tempId`; cache giữ `localUrl` (objectURL) + progress/status. `useSendMessage` đọc stash ở onMutate (preview) + mutationFn (upload), clear (revoke) onSuccess. **tempId sinh ở component** (KHÔNG ref trong hook) — tránh race khi nhiều send.
> **Retry resume**: item upload xong set `a.uploaded` ⇒ retry chỉ re-upload item chưa xong; POST chỉ khi đủ N media (KHÔNG partial-send). Successful-but-unsent uploads = orphan nếu user bỏ (accepted).
> **2 uploads/ảnh (Q6)**: gốc untouched (lightbox dùng `url`) + thumbnail JPEG (grid + optimistic preview dùng `thumbnailUrl`/`localUrl`). Video poster reuse `extractVideoThumbnail` (1080px q0.9). Pool cap-3 over items ⇒ tối đa 6 PUT in-flight.
> **Lightbox open-gate**: cell optimistic (`uploadStatus` set, localUrl) KHÔNG mở (chỉ local url); mở khi swap thành message thật (status cleared). Video preview cell dùng poster (`<img>`) không phải `<video>` để render được khi đang upload.
> **`MediaType` reuse** (IMAGE/VIDEO đã có từ 2.4a); `Message.media` required `[]` ⇒ optimistic Message PHẢI set `media` (+ `reactions:[]`).

## Phase 5.4b — Voice Messages — DONE

Tap mic → ghi âm (MediaRecorder WebM/Opus) → tap send để stop + auto-send → bubble voice player + 30 thanh sóng trang trí. Optimistic local playback. `tsc -b` + `vite build` 0 lỗi. 5 decision FINAL: Q1 tap-toggle · Q2 MediaRecorder WebM/Opus (no dep) · Q3 HYBRID 30-bar · Q4 max 300s · Q5 reuse 5.4a.

- [x] **Types**: `MediaType += 'VOICE'`. `MessageMediaInput.thumbnailUrl?`/`thumbnailObjectKey?` optional. `PresignRequest.contentType += 'audio/webm'`.
- [x] **`lib/audio.ts`** (NEW): `VOICE_MAX_DURATION=300`, `VOICE_MIME='audio/webm'`, `formatDuration` (reuse VoicePlayer + MediaCell — gỡ inline trùng), `generateWaveformBars(seed, 30)` (FNV-1a + xorshift deterministic, heights 30–90%, KHÔNG decode audio — Q3).
- [x] **`hooks/useVoiceRecorder.ts`** (NEW): `getUserMedia({audio})` + `MediaRecorder` (`audio/webm;codecs=opus` fallback `audio/webm`). **Duration = wall-clock timer** (WebM MediaRecorder không có duration metadata tin được). Auto-stop 300s. State `idle|requesting|recording|denied|unsupported`. `start/stop/cancel`; `onComplete({blob,duration})`. Cleanup `stream.getTracks().stop()` + clearInterval ở stop/cancel/unmount. Support-guard: `MediaRecorder.isTypeSupported('audio/webm')` false (Safari) → `unsupported`.
- [x] **`mediaUpload.ts` extend**: `PreparedAttachment.thumbnailBlob?`/`width?`/`height?` optional + type `+'VOICE'`. `uploadAttachments` worker: `!thumbnailBlob` (voice) → **1 PUT** (gốc 0–100%) + input bỏ thumbnail/width/height. `prepareVoiceAttachment(blob, duration)` (file `voice.webm`, previewUrl=objectURL clip). **Send reuse 100%**: VoiceRecorder.onComplete → `setPendingAttachments(tempId,[att])` → `useSendMessage.mutate({tempId})` (optimistic media VOICE + progress + retry y nguyên).
- [x] **Components**: `VoicePlayer.tsx` (NEW) — `<audio src={localUrl ?? url}>` + play/pause + 30 bars fill `i/30 < currentTime/duration`; own bubble filled=`primary-foreground` (tránh primary-on-primary), other=`primary`, unfilled `…/40`÷`muted-foreground/30`; uploading → spinner ở nút play vẫn phát localUrl. `MessageBubble` branch `isVoice = media.length===1 && media[0].type==='VOICE'` → VoicePlayer (KHÔNG grid). `MessageInput` nút mic **morph send↔mic theo `hasContent`** (composer rỗng → mic; có text/file → send); recording UI thay input row (Trash cancel + chấm đỏ pulse + timer `formatDuration(elapsed)` + Send-stop); `denied`/`unsupported` → error text (reuse pattern T5). `messagePreview` `🎤 Voice (m:ss)`.

> **Reuse 5.4a triệt để**: voice KHÔNG có flow gửi riêng — chỉ là `PreparedAttachment` no-thumbnail (1 PUT thay 2) đi qua `pending-stash` + `useSendMessage`. Optimistic/progress/retry/cache patch dùng chung.
> **Duration timer (KHÔNG metadata)**: webm blob của MediaRecorder thường `duration=Infinity` ⇒ đo `Date.now()` start→stop (cap 300s). Truyền vào `prepareVoiceAttachment` → MessageMediaInput.duration.
> **Send↔mic morph**: `hasContent = text || files` (KHÔNG `canSend` — tránh hiện mic khi có text lúc đang pending). Voice exclusive ⇒ mic chỉ xuất hiện khi composer rỗng.
> **Bar contrast**: own message bubble bg=primary ⇒ filled bar phải `primary-foreground`.
> **Safari**: MediaRecorder Safari KHÔNG hỗ trợ `audio/webm` → state `unsupported` + error (KHÔNG crash). `audio/mp4` codec → BACKLOG.

## Phase 5.4c — Emoji + Sticker + GIF + Post Share — DONE

1 picker hợp nhất 3 tab (Emoji | Stickers | GIFs, Popover + toggle tự code) trong MessageInput + nút Share trên PostCard → modal chọn 1 conversation. `tsc -b` + `vite build` 0 lỗi 2095 modules. Đóng Phase 5.4. 8 decision FINAL (Q-Scope/Q-Emoji-Source/Q-Emoji-ContentType/Q-Picker + E1/E2/E3/E7/E8).

- [x] **Types/data**: `MediaType += 'STICKER'|'GIF'`; `SharedPostPreview` (narrow — id/caption/author Pick/firstMedia, **KHÔNG full Post** → tránh stale counts); `Message.sharedPost?`; `SendMessageInput.sharedPostId?`; `GiphyItem`; `MessageMediaInput.objectKey?` optional. `lib/emoji.ts` NEW (`isEmojiOnly` + `EMOJI_ONLY_MAX=3`, `Intl.Segmenter` grapheme + `\p{Extended_Pictographic}` — **MIRROR backend byte-for-byte**). `api/giphy.ts` NEW (`giphyApi.search/trending`).
- [x] **Send reuse**: `mediaUpload.prepareGiphyAttachment` set `uploaded` preset (type/url/w/h) ⇒ `uploadAttachments` short-circuit **0 PUT** (như voice nhưng bỏ cả PUT); `PreparedAttachment.file?/fileContentType?` optional. `useSendMessage` optimistic contentType derive **+EMOJI/STICKER/GIF/VOICE** (mirror BE, tránh flicker giant↔normal). Emoji standalone + sticker/gif đều qua `setPendingAttachments`/content + `mutate` — KHÔNG flow gửi riêng.
- [x] **`useSharePost.ts` NEW** (KHÔNG extend `useSendMessage` vốn bind conversationId): share từ feed, target động, không xem thread ⇒ no optimistic in-thread; `mutate({conversationId, postId, content?})` → `sendMessage({sharedPostId, content})` → `patchConversationOnNewMessage` + invalidate `messages(id)` **+ `conversation(id)`** (fix Bug 3 dưới).
- [x] **`UnifiedMediaPicker.tsx` NEW**: Popover (reuse `ui/popover`), 3 nút tab tự code (**KHÔNG shadcn tabs/sheet**). Emoji tab = embed emoji-mart `<Picker dynamicWidth>` (reuse 4.3a `EmojiPickerOverlay` pattern); Stickers/GIFs = `GiphyGrid` (search debounce 400ms / rỗng→trending, masonry `columns-2`, loading/empty/503). `MessageInput`: nút `Smile` (luôn enabled) + `insertAtCursor` + **emoji Case A** (có text→insert, picker mở tiếp) / **Case B** (rỗng→send giant + đóng); sticker/gif → send standalone + đóng (text textarea giữ nguyên).
- [x] **Render**: `MessageBubble` 3 nhánh mới (trong anchor, giữ reaction/`canReact`): `POST_SHARE → SharedPostCard`; `EMOJI → content text-6xl no-bubble` (caption bubble skip khi isJumbomoji); `STICKER/GIF (1 media) → inline <img> no-grid/no-lightbox`. `SharedPostCard.tsx` NEW (avatar+@username+firstMedia+caption, click → `/posts/:id`; null → "Post unavailable"). `SharePostModal.tsx` NEW (mirror `StoryViewersModal` Dialog, `useConversations`+`conversationDisplay`, caption optional, single-select). `PostActions` enable Share + `onShare`; `PostCard` state + render. `messagePreview` +`📮 Shared a post`/`Sticker`/`GIF` (EMOJI = content char).

> **EMOJI content-derived (KHÔNG media)**: emoji-only message giant, derive ở server + FE mirror `isEmojiOnly`; emoji gõ tay LẪN picker (textarea rỗng) đều giant. KHÔNG `MediaType` EMOJI, 0 migration.
> **Sticker/GIF reuse pipeline 0-PUT**: `PreparedAttachment.uploaded` preset (Giphy URL) ⇒ optimistic/swap/cache patch dùng chung; objectKey null (Giphy host).
> **3 follow-up UX fix (browser-verify):**
> - **Bug 1+2 scroll** (`MessageThread`): reaction làm bubble cao thêm KHÔNG auto-scroll (effect cũ chỉ scroll khi `newestId` đổi). Fix: `atBottomRef` (qua `onScroll`) + nhánh layout-effect "content cao lên khi đang ở bottom → stick". + nút nổi `ChevronDown` `absolute bottom-4 right-4` (hiện `dist>200`, smooth scroll), bọc scroll container `relative` parent. Unread badge defer.
> - **Bug 3 POST_SHARE Seen realtime**: share gửi NGOÀI thread ⇒ A không vào convo room ⇒ miss `read-receipt:update` (emit convo-room only) + `staleTime:30s` serve cursor cũ (F5 "fix" vì reload). Fix 1 dòng: `useSharePost.onSuccess` invalidate `conversation(id)` ⇒ mở thread refetch participants tươi. KHÔNG đụng MessageBubble (Seen indicator vốn dùng chung mọi contentType — đúng).
> - **Emoji-mart ~70% width**: `dynamicWidth` đo wrapper shrink-to-fit; `className="width-full"` no-op (emoji-mart coi className là option, không gắn DOM). Fix: scoped CSS `.emoji-picker-full > *, .emoji-picker-full em-emoji-picker { width:100% }` (index.css) + wrap `<div className="emoji-picker-full w-full">`. **Scoped** → story `EmojiPickerOverlay` (natural width) KHÔNG regress.

## Phase 5.5 — Group create UI + Recall message — DONE (đóng Phase 5)

Nút "+" (`SquarePen`) ở header `ConversationList` → modal tạo group; "..." menu trên bubble của mình → Delete (recall). `tsc -b` + `vite build` 0 lỗi 2101 modules. 10 decision FINAL (scope create+recall · tombstone · skip-to-previous · name auto-derive · reactions clear · "..." riêng · DELETE+message:deleted · S3 soft-fail · confirm required · deleteObject helper). reply-to + group member management → BACKLOG.

- [x] **Types/data**: `types/api` (`GroupableUser extends PublicUser` +`source:'recent'|'mutual'`; `Message.deletedAt?: string|null`; `CreateGroupInput.name?` optional; `MessageDeletedPayload {conversationId,messageId,deletedAt}`). `api/users.getGroupable(q?,limit?)` (bare array, search-driven no-cursor) + `api/messages.recallMessage(id)`. `queryKeys.groupableUsers(q)`.
- [x] **Group create**: `useGroupable(q, enabled)` (useQuery, caller debounce 300ms, `staleTime 30s`). `useCreateGroup` (**mirror `useStartDirectConversation`**: `setQueryData(conversation(id))` + invalidate `conversations()` + `navigate('/messages/'+id)`). `GroupCreateModal` (Dialog mirror `SharePostModal` `max-w-md gap-0 p-0`: optional name input + selected pills row [max **9 others** = group 10] + search debounce + 2 section recent/mutual với checkbox + Create disable khi `<2 selected`; empty-state phân biệt searching vs pool rỗng). `ConversationList` local `useState` mở modal (KHÔNG store — trigger 1 nơi, mirror SharePostModal).
- [x] **Recall**: `lib/messageCache.patchMessageDeleted(qc,convId,msgId,deletedAt)` (set deletedAt + clear content/media/reactions/sharedPost; **idempotent guard `m.deletedAt`** → optimistic + socket echo không nhân đôi; same-ref-when-unchanged). `useRecallMessage(convId)` (optimistic patchMessageDeleted + snapshot/rollback onError [vd 410]; onSuccess re-patch + **invalidate `conversations()`** để preview skip-to-previous). `useGlobalSocketEvents` +listener `message:deleted` → patchMessageDeleted + invalidate conversations. `MessageBubble`: **nhánh tombstone ĐẦU TIÊN** (sau hooks, trước main return) → placeholder Trash + "Message deleted" giữ slot align own/other, ẩn reactions/seen/menu; **"..." `RecallMenu`** chỉ khi `canReact && isOwn` (canReact = `!temp`). `RecallMenu` (Popover riêng `MoreHorizontal` → item "Delete" disable+`title` "Cannot delete after 15 minutes" nếu `>15min` client-guard → `RecallConfirmDialog`). `RecallConfirmDialog` (Dialog confirm required, destructive button).

> **UI label = "Delete", internal = recall** (Decision Issue 2): user-facing "Delete"/"Delete this message?" + placeholder "Message deleted"; nhưng giữ `recallMessage`/`useRecallMessage`/`patchMessageDeleted`/`RecallMenu.tsx`/`RecallConfirmDialog.tsx` (HTTP `DELETE /messages/:id` + socket `message:deleted` đã khớp verb). File names giữ cho git history.
> **Recall trigger TÁCH long-press** (Decision 6): long-press/hover GIỮ cho reaction picker (5.3a); "..." button riêng cho recall. 2 Popover instance độc lập trong cùng bubble — RecallMenu dùng `PopoverTrigger` chuẩn (KHÔNG custom anchor) nên KHÔNG dính gotcha anchor-race của reaction Popover.
> **Tombstone optimistic không flicker**: `useRecallMessage` onMutate patch ngay → bubble thành "Message deleted" tức thì; server trả tombstone (200) reconcile; socket `message:deleted` tới các tab/người khác → patchMessageDeleted (idempotent).
> **15-phút = client guard + server authority**: RecallMenu ẩn/disable theo `Date.now()-createdAt`; server vẫn 410. Drift nhỏ → request hỏng, optimistic rollback.
