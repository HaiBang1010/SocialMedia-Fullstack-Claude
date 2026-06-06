# Frontend — Project Memory

> Phase 1A/1B/1C + Phase 2 FE (2.4a/b/c posts UI + 2.5 follow/profile counts/public profile) + Phase 3.1 (multi-image carousel) đã build xong. File này là rules + setup thực tế; xem các section "Phase 2.4a"/"Phase 2.5 — DONE"/"Phase 3.1 — DONE" cuối file cho chi tiết.

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
