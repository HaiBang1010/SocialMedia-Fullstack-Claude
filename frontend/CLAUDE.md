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
