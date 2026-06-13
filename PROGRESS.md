# Progress Log

> Nhật ký work session. Mỗi lần ngồi xuống code → cập nhật mục mới nhất.
> Mục đích: 1 tuần sau quay lại không lạc đường.
> Đọc cùng với README.md (status cao cấp) và BACKLOG.md (việc sắp tới).

---

## 2026-06-13 — Checkpoint 5.3a: Message Reactions (7-emoji quick set + aggregate chips + optimistic + realtime)

**Done (BE migration `add_message_reactions` applied + `prisma generate` + `tsc` 0 lỗi + reactions smoke 13/13 PASS trên server live + OpenAPI 33 paths [32→+1]; FE `tsc -b` + `vite build` 0 lỗi 2077 modules [+9]).** Long-press (mobile) / hover (desktop) → picker 7 emoji → react; aggregate chips "👍 3  ❤️ 1" dưới bubble; optimistic + socket `message:reaction` realtime. 8 decision FINAL (D1–D8) chốt trước khi code. GROUP "Seen by N" tách **5.3b** (FE-only).

- **Backend (~7 file + 1 migration)**: model **`MessageReaction`** (`@@id([messageId,userId])` + `message`/`user` cả 2 `onDelete: Cascade` — D1 Like parity; `Message.reactions` + `User.messageReactions`). `messages.schema`: `REACTION_EMOJIS_BACKEND` (copy byte-for-byte FE) + `reactionSchema z.enum` + `messageResponseSchema.reactions`. `messages.service`: `messageInclude.reactions` (orderBy createdAt asc) + `serializeMessage` map RAW (D2) + `getParticipantIds` helper (extract khỏi sendTextMessage, 3 call site) + `reactToMessage`(upsert/replace) + `removeReaction`(deleteMany idempotent) (auth `assertCanReact`: 404 message gone / 403 non-participant). `conversations.service`: `conversationInclude.messages` include reactions (type parity). **`messages.routes.ts` NEW** (POST/DELETE `/:id/reactions`) mount `/messages` ở server.ts. `messages.openapi` +2 op (1 path key). `io.ts` **`emitMessageReaction`** → user rooms delta (D5/D6).
- **Frontend (~13 file)**: `npx shadcn add popover` (radix-ui umbrella, v4 ready, 0 adapt). `lib/reactions.ts` (SOURCE `REACTION_EMOJIS` + `groupReactionsByEmoji` + `myReaction`). `types/api.ts` (`MessageReaction` + `Message.reactions` + `MessageReactionPayload`; optimistic Message thêm `reactions:[]`). `api/messages.ts` NEW (`messagesApi`). `hooks/useLongPress.ts` NEW (500ms, cancel-on-move, skip mouse). `useReactToMessage.ts` NEW (optimistic patch + rollback + reconcile + `toggle`). `messageCache.patchMessageReactions` (mirror setMessageFailed). `useGlobalSocketEvents` +`message:reaction` listener. `ReactionPicker`/`ReactionChips` NEW. `MessageBubble` refactor (controlled Popover, anchor=bubble, hover SmilePlus + long-press, `canReact` chặn temp, layout bubble→chips→status, meId local).

**8 decision FINAL:** D1 user-relation cascade (Like parity); D2 RAW DTO `[{userId,emoji}]`; D3 2-endpoint POST/DELETE (toggle client-side); D4 return full message; D5 socket user-rooms; D6 delta payload `{conversationId,messageId,userId,emoji|null}`; D7 shadcn Popover; D8 GROUP "Seen by N" → 5.3b.

**Lưu ý kỹ thuật:**
- **Emoji byte-exactness**: `❤️` = U+2764 + U+FE0F (variation selector). FE `lib/reactions.ts` là source; BE `REACTION_EMOJIS_BACKEND` copy y nguyên — gõ tay sẽ fail Zod enum match silently.
- **Type parity serializeMessage**: thêm `reactions` vào `messageInclude` ⇒ PHẢI thêm cả `conversationInclude.messages` (cùng `MessageRow` type), nếu không lastMessage preview vỡ TS. Cost: 1 message/convo mang reactions — negligible.
- **canReact chặn temp/failed**: react cần real id; optimistic (`temp-`) ẩn trigger + chips. `useSendMessage` optimistic Message thêm `reactions:[]` (type required).
- **Toggle 1 nguồn**: picker + chip đều `toggle(id, myEmoji, tapped)` → tap-same=remove, khác=replace. Optimistic key theo meId ⇒ rapid clicks settle về click cuối.
- **EPERM khi generate**: `tsx watch` dev server giữ `query_engine-windows.dll.node` ⇒ `prisma generate` fail EPERM. Phải stop dev server → generate → restart. (Windows file-lock, không phải bug code.)

**Next:** Browser-verify 2 incognito (long-press mobile, hover desktop, optimistic chip, cross-session realtime <1s, toggle off/replace, aggregate, layout order) → Phase **5.3b** GROUP "Seen by N" (FE-only).

---

## 2026-06-13 — Checkpoint 5.2 polish: typing heartbeat + typing-in-thread + date separators + avatar fix + profile links

**Done (FE `tsc -b` + `vite build` 0 lỗi 2068 modules; socket smoke typing/snapshot/regression PASS trên server live; committed `34d2427`). Tiếp theo "5.2 follow-up" — typing vẫn hỏng ở browser sau fix listener-order, root cause thứ 2 + loạt UX polish.**

- **Typing heartbeat (root cause #2)**: listener-order fix (follow-up) CẦN nhưng CHƯA ĐỦ. Sender emit `typing:start` đúng 1 lần (activeRef guard) + receiver TTL 4s tự hết → indicator revert ~4s khi gõ liên tục, và activeRef kẹt true ⇒ không re-emit ⇒ không hiện lại. Fix `useTypingEmit`: **heartbeat re-emit `typing:start` mỗi 2.5s** (< receiver TTL 4s) trong lúc gõ; stop-debounce 3s giữ nguyên.
- **Typing → đáy MessageThread** (rời header): `TypingIndicator` (text "X is typing" + 3 dots animate, keyframe `typing-dot` ở index.css, no avatar) + auto-scroll giữ trong tầm nhìn khi near-bottom. `ConversationDetail` header subtitle = **presence-only** (bỏ typing logic + `useTypingStore`).
- **Date separators**: `DateSeparator` + `formatDateSeparator`/`isSameDay` (format.ts). Chèn giữa bursts khi **cross-day HOẶC gap >1h** (first burst = anchor); 24h local + IG-style (Today→`14:07` / `Yesterday` / weekday / `Jun 3` / `Jun 3, 2024`). **Bỏ per-burst timestamp** (`formatRelativeTime(burst.lastAt)`) — consolidate vào separator.
- **Avatar regression fix**: wrapper 5.2 (relative outer cho online dot) tách `SIZES[size]`→inner còn `className`→outer ⇒ caller truyền `size-16`/`ring-2` qua className gây **gap** (StoryRingItem/StoryBar) + **viền chữ nhật** (StoryBar/StoryViewer ring quanh outer không-rounded). Fix: outer giữ `rounded-full + SIZES[size] + className`, inner `size-full`.
- **Profile-link navigation**: avatar người-khác trong thread + DIRECT header (avatar/name) → `<Link to=/users/:username>`. `conversationDisplay` thêm `otherUsername`. GROUP header KHÔNG link (group settings defer 5.5); back button tách ngoài Link.

**Lưu ý kỹ thuật:**
- **Typing đòi 2 fix độc lập**: (1) BE listener-order (receiver phải vào convo room — đăng ký `socket.on` trước await), (2) FE heartbeat (giữ TTL receiver sống). Thiếu 1 trong 2 → typing hỏng theo cách khác nhau (không vào room / revert sau 4s).
- **Avatar wrapper rule**: khi bọc thêm element ngoài, phải đẩy `size + shape (rounded-full) + className` lên OUTER, inner `size-full`. Nếu để `ring`/`size` từ className rơi lên outer không-rounded/không-size → ring thành hình chữ nhật + size lệch inner. cuid-style twMerge (`size-14`+`size-16`→`size-16`) chỉ đúng khi cùng 1 element.
- **Render-đúng-nhưng-UI-trống ≠ CSS**: diagnostic typing dùng banner-đỏ unconditional + `display` flag + computed-style loại trừ H1(display)/H2(CSS)/H3(render-condition) → thực ra là typing revert (TTL) do thiếu heartbeat. Subtitle class gốc (`truncate text-xs text-muted-foreground`) chưa bao giờ là bug.

**Next:** Phase 5.3+ (reactions / media / recall / group UI). Browser-verify polish (typing persist khi gõ liên tục, date separator các nhánh, avatar fill ring, profile navigate + back).

---

## 2026-06-13 — Checkpoint 5.2 follow-up: browser-verify fixes (4 issues)

**Done (BE `tsc` 0 lỗi + FE `tsc -b`/`vite build` 0 lỗi 2068 modules; socket verify smoke 3/3 + regression 5/5 PASS trên server live).** 4 issue phát hiện khi browser-verify, 2 decision chốt (T5 hide-seen-on-reply, T7 failed+retry).

- **Issue 2 (typing) — ROOT CAUSE THẬT**: `socket/index.ts` connection handler `async` **`await getConversationPartners()` chạy TRƯỚC khi đăng ký `socket.on('conversation:join'|'typing'|'message:read')`**. Client emit `conversation:join` ngay sau connect → rơi vào cửa sổ await → listener chưa gắn → **event bị Socket.io DROP** → recipient không vào convo room → typing/read-broadcast mất. `message:new` không dính vì `joinUserRoom` là sync trước await. **Fix**: đăng ký TẤT CẢ `socket.on` đồng bộ TRƯỚC mọi await; presence async chuyển xuống `void (async()=>{…})()` cuối. Diagnostic smoke chứng minh: user-room message:new RECEIVED nhưng convo-room typing MISSING khi join emit ngay lúc connect.
- **Issue 4 (T7) — offline message lost**: `useSendMessage.onError` gọi `restoreMessages` → xóa optimistic → mất tin. **Fix**: KHÔNG restore; `markMessageFailed` set `Message.failed=true` (giữ trên màn hình). `MessageBubble` failed → ring đỏ + "Failed — tap to retry" → `onRetry(message)` (MessageThread `useSendMessage` mutate `{content, retryTempId}` → `clearMessageFailed` → resend, swap khi success / re-mark khi fail). Bỏ `snapshotMessages`/`restoreMessages`/`MessageCacheSnapshot` (orphan sau đổi).
- **Issue 1 (T1) — last-seen offline**: `presence:snapshot` chỉ emit `{online}`, không có lastSeen → partner offline-sẵn không hiện "Active X ago". **Fix**: BE snapshot kèm `lastSeen: Record<userId,ISO>` (query `User.lastSeenAt` cho partnerIds). FE `presenceStore.setSnapshot({online,lastSeen})` merge; `ConversationDetail` "Active {rel} ago" (rel==='now' → "Active now").
- **Issue 3 (T5) — hide Seen on reply** (deviate IG): `MessageThread.seenMessageId` thêm check — nếu recipient gửi message SAU read cursor (`messages.slice(readIdx+1).some(senderId!==me)`) → ẩn Seen (null); else giữ logic positional cũ.

**Verify**: socket verify smoke 3/3 (typing với immediate-join PASS, snapshot lastSeen PASS, B-not-online PASS) + regression 5/5 (presence:online, REST send, message:new, read-receipt, presence:offline+lastSeenAt). Issue 3+4 frontend-logic (build pass) — **cần browser confirm**: retry tap khi offline; Seen biến mất sau khi B reply.

**Next:** Browser verify 2 incognito 4 issue → commit `fix(messaging): typing listener-order + offline retry + last-seen snapshot + hide-seen-on-reply (5.2 follow-up)` thẳng main.

---

## 2026-06-12 — Checkpoint 5.2: Messaging Realtime (Socket.io — message:new + typing + presence + read receipts)

**Done (BE migration `add_user_last_seen_at` applied + `prisma generate` + `tsc` BE 0 lỗi + socket smoke 12/12 PASS; FE `tsc -b` + `vite build` 0 lỗi 2068 modules; OpenAPI vẫn 32 paths. Thay polling 5s bằng Socket.io. Send VẪN REST — socket receive-only.)**

- **Backend (~9 file + 1 migration)**: `User.lastSeenAt DateTime?`. Dep `socket.io@4.8`. Module mới **`src/socket/`** (io/auth/presence/rooms/index — singleton ref + JWT handshake + presence ref-count multi-tab + offline-debounce 5s + room helper). `server.ts` `initSocket(server, env.CORS_ORIGIN)` (attach vào `app.listen()` return, KHÔNG `http.createServer`) + `io.close()` shutdown. `messages.service`: export `isParticipant`, `sendTextMessage` broadcast `emitNewMessage` cuối hàm, thêm `markConversationRead` + `getConversationPartners`. `conversations.service`/`schema` participants thêm `lastReadMessageId`.
- **Frontend (~13 file)**: `lib/socket.ts` singleton (auth callback đọc token tươi), 3 store (socket/presence/typing), `lib/conversationCache.ts` + `messageCache` extend (insertIncomingMessage dedup + messageExists), 4 hook (useSocketConnection/useGlobalSocketEvents/useConversationSocket/useTypingEmit), `useMessages` bỏ refetchInterval, `useSendMessage` patch list thay invalidate. UI: Avatar online dot, conversationDisplay otherUserId, ConversationListItem/ConversationDetail presence+typing, MessageThread seenMessageId positional, MessageBubble "Seen", MessageInput typing emit, AppLayout mount global hooks.

**5 decision FINAL (D1–D5) + 6 refinement (đã verify):**
- **D1 send giữ REST** — socket broadcast `message:new` sau DB write; `message:send` C→S unused. Smoke: B nhận message:new đúng content PASS.
- **D2 presence contact-scoped** — connect emit online cho partners + snapshot cho mình; disconnect (tab cuối, debounce 5s) persist lastSeenAt + offline. Smoke: snapshot/online/offline PASS.
- **D3 migration `add_user_last_seen_at`** (snake_case) — `User.lastSeenAt DateTime?` nullable.
- **D4 participant DTO + lastReadMessageId** — read receipt. **Refinement: tính POSITIONAL trong MessageThread** (cuid KHÔNG sort theo thời gian ⇒ KHÔNG so `id >=` lexical), MessageBubble nhận prop `showSeen`. DIRECT only.
- **D5 conversations-list PATCH** — move-to-top + preview thay invalidate-on-send; incoming cùng patch (idempotent).
- **Refinement khác**: conversationDisplay `otherUserId`; Avatar relative-wrapper (dot không bị clip); unread badge defer; mount hook ở AppLayout (không App.tsx); KHÔNG sửa conversations.openapi (schema tự lan).

**Lưu ý kỹ thuật — pattern mới 5.2:**
- **io.ts type-only import socket.io** ⇒ messages.service import emit helper KHÔNG cycle (1 chiều service→io.ts, mirror lib/prisma singleton).
- **Auth callback (KHÔNG token param)**: `auth:(cb)=>cb({token: store.accessToken})` đọc token tươi mỗi reconnect ⇒ token expiry mid-connection tự fix qua axios-refreshed store, không cần socket refresh path.
- **Reconnect safety net BẮT BUỘC**: Socket.io self-heal nhưng KHÔNG replay missed message ⇒ `socket.io.on('reconnect')` → `invalidateQueries(['conversations'])` (prefix match list+detail+messages). Điều kiện để bỏ polling an toàn.
- **Dedup self-echo race**: broadcast chạm cả sender; socket echo có thể về trước REST response ⇒ insertIncomingMessage replace temp (sender+content) thay prepend, onSuccess check messageExists thay invalidate mù.
- **Presence flicker**: offline debounce 5s server-side + ref-count multi-tab (online 1 lần tab đầu, offline 1 lần tab cuối).
- **Typing TTL backstop 4s client** phòng mất typing:stop; `socket.to(convoRoom)` exclude người gõ server-side.

**DB note**: socket smoke tạo 2 user `ska_/skb_<base36 ts>` + 1 direct conversation + 1 message — leftover DB dev (vô hại).

**Next:** Browser verify 2 incognito (presence online/offline + last-seen, message realtime <1s không chờ 5s, typing indicator, "Seen", reconnect refetch, multi-tab dedup, dark+mobile). PASS → commit `feat: messaging realtime — socket.io message:new + typing + presence + read receipts (Checkpoint 5.2)` thẳng main. Sau đó Phase 5.3+ (reactions/media/recall/group UI).

---

## 2026-06-11 — Checkpoint 5.1: Messaging Foundation (Conversation/Message models + REST + responsive UI + optimistic send)

**Done (BE migration applied + `prisma generate` + `tsc` BE 0 lỗi + smoke API 31/31 PASS + OpenAPI 32 path keys; FE `tsc -b` + `vite build` 0 lỗi 2030 modules; browser verify FE 8/8 + bonus PASS; 3 UX fix mid-test). Phase 5 mở màn — KHÔNG Socket.io (defer 5.2), KHÔNG image/video message (defer 5.4).**

- **Backend (10 file + 1 migration)**: 3 model `Conversation`/`Participant`/`Message` + 2 enum (`ConversationType`, `MessageContentType` đủ 8 value gate TEXT). Module `conversations/` (schema/service/routes/openapi) + `messages/` (schema/service/openapi, KHÔNG routes — endpoint dưới `/conversations/:id/messages`). 6 endpoint: direct/group create, list, get, list+send messages. Mount `/conversations` + wire OpenAPI (Messages trước Conversations để Conversation `$ref` Message).
- **Frontend (~17 file)**: data layer (types + `api/conversations` + queryKeys + `messageCache` + `messageBurst`), 5 hook (`useConversations`/`useConversation`/`useMessages` polling 5s/`useSendMessage` optimistic/`useStartDirectConversation`), 7 component + `MessagesPage` responsive + `conversationDisplay` helper. Wiring: 2 route, Sidebar/BottomNav "Messages", profile nút Message.

**4 decision chốt + 2 refinement (đã verify):**
- **D1 directKey race-safe**: `Conversation.directKey String? @unique` = `[a,b].sort().join(':')` → `findOrCreateDirectConversation` = `upsert` (idempotent, KHÔNG `$transaction` — khớp idiom Follow/Like/StoryView). GROUP `directKey=null`. Smoke: 2-direction → cùng id PASS.
- **D2 full nullable schema**: migrate đủ field Conversation+Participant+Message; defer model `MessageMedia/MessageReaction/Call`. `MessageContentType` đủ 8 value DB + Zod gate TEXT (pattern StoryItemType 4.3a). `replyToId`/`sharedPostId` scalar-only (như `Notification.postId`; FK relation → 5.5).
- **D3 breakpoint md (768)**: reuse `useIsDesktop` (KHÔNG breakpoint riêng).
- **D4 newest-first store / reverse render**: cache newest-first (cursor BE), `MessageThread` `[...].reverse()` → oldest top/newest bottom; optimistic temp prepend page[0] = đáy sau reverse.
- **R1 lastMessageAt** (xác nhận: KHÔNG query Prisma nào order parent theo child latest): denormalize `Conversation.lastMessageAt @default(now())`, bump trong `sendTextMessage`, order `[{lastMessageAt desc},{id desc}]`. Smoke: convo bubble lên top sau send PASS.
- **R2 404-read/403-write** (`prefer-404-over-403-private`): non-participant GET convo/messages → **404** (ẩn existence); POST message → **403** (write). Smoke cả 2 PASS.

**Lưu ý kỹ thuật — pattern mới Phase 5.1:**
- **Tránh circular import 2 service**: mỗi service tự `isParticipant` check (KHÔNG dùng chung helper) ⇒ import 1 chiều `conversations.service → messages.service` (chỉ `serializeMessage`), KHÔNG cycle.
- **Scroll preserve on prepend**: `useLayoutEffect` + `loadingOlder` ref (capture `scrollHeight` trước fetchNextPage) → restore `scrollTop = scrollHeight - prev` khi older load (newestId KHÔNG đổi); else scroll-bottom khi newestId đổi (new msg/initial).
- **Polling tab-inactive auto-pause**: TanStack v5 `refetchInterval:5000` + default `refetchIntervalInBackground:false` ⇒ KHÔNG poll khi tab ẩn, refetch on focus. KHÔNG code tay.
- **Module split message-under-conversation**: 2 endpoint message ở `conversations.routes` delegate `messages.service` (pattern `posts/:id/comments`); standalone `/messages/:id` (DELETE/reactions) defer 5.5 ⇒ KHÔNG `messages.routes.ts` 5.1.
- **Optimistic = useCreateComment** (KHÔNG useCreatePost): temp-id reconcilable swap-in-place; `swapTempMessage` fallback invalidate.

**UX fixes (browser verify mid-test — 3 fix, mỗi fix `vite build` 0 lỗi):**
- **MessageBubble text wrap** (`MessageBubble.tsx`): bug "Hello" wrap giữa từ → "He/llo" + long token overflow ngang. Root cause = `max-w-[75%]` là fraction của wrapper `flex justify-*` **shrink-to-fit** ⇒ `width ≤ 0.75×(own width)` circular collapse về min-content ⇒ `break-words` character-break. Fix: `max-w-[75%]` → **`max-w-full`** (cap thật = parent column `max-w-[80%]`, anchored vào row width definite — hết collapse) + `break-words` → **`[overflow-wrap:anywhere]`** (long no-space "zzz…"/URL break trong cột). `whitespace-pre-wrap` giữ (newline Shift+Enter). Lưu ý: đề xuất ban đầu giữ `max-w-[75%]` sẽ làm bug NẶNG hơn (anywhere → collapse ~1 char/dòng).
- **(Pattern 31) Global scrollbar styling** (`index.css`, cross-theme + thin): `::-webkit-scrollbar` 8px + track `transparent` + thumb `oklch(0.55 0 0 / 0.4)` (gray + alpha, **KHÔNG `var(--muted)` token** → cùng 1 màu đúng cả light + dark) hover `/0.6`; Firefox `html { scrollbar-width: thin; scrollbar-color }`. `.scrollbar-hide` (StoryBar/Carousel) GIỮ ẩn — class specificity > global `::-webkit-scrollbar`. Minifier convert thumb oklch→`#71717166` (gray gamut lossless, visual giống hệt).
- **MessageInput textarea scrollbar**: thử `pr-4` (gap cho scrollbar) → đổi **`scrollbar-hide`** (reuse util Phase 4) + revert về `px-3` symmetric. `scrollbar-hide` chỉ ẩn VISUAL (`overflow` giữ) ⇒ scroll wheel/arrow/touch/auto-scroll-typing vẫn work. Message thread KHÔNG opt-in ⇒ vẫn hiện thin-gray global (textarea-only hide).

**DB note**: smoke test tạo 3 user `msga_/msgb_/msgc_<base36 ts>` + 1 group "Trip" + vài message — leftover trong DB dev (vô hại, có thể `prisma studio` xóa nếu muốn sạch).

**Next:** Browser verify DONE (31 BE smoke + 8 FE case + bonus PASS; 3 UX fix mid-test). Commit `feat: messaging foundation — conversations + messages + responsive UI (Checkpoint 5.1)` thẳng main. Sau đó Phase 5.2 Socket.io realtime.

---

## 2026-06-10 — Checkpoint 4.4 follow-up: browser-verify bugfixes (cron interval + video reopen)

**Done (2 bug từ browser verify 4.4; `tsc` BE/FE + `vite build` 0 lỗi 2013 modules):**
- **Cron interval 1h → 5 phút** (`archiveExpiredStories.ts`): archive page trống vì 3 story expired chưa flip `isArchived`. Root cause KHÔNG phải code bug — sweep đúng (edit jobs file → tsx reload → immediate-run archive cả 3: isArchived false→true; `listArchivedStories` trả test1=2/test2=1); nguyên nhân interval 1h + dev server không chạy liên tục ⇒ không tick fire trong window story expired. 5 phút + run-immediately làm archive responsive. Docs synced (backend/CLAUDE, ARCHITECTURE §6, PROGRESS entry 4.4).
- **Video archive reopen frozen** (`StoryViewer.tsx`): reopen CÙNG video story → video đứng nhưng progress bar chạy → desync. Fix Option A: thêm `isOpen` vào deps effect video play/pause.

**Lưu ý kỹ thuật:**
- **Video play effect phải gate thêm `isOpen`**: viewer KHÔNG unmount khi close (chỉ `return null`) ⇒ `currentStoryIndex`/`currentStory.id` (component state) PERSIST qua close. Reopen cùng story ⇒ id không đổi ⇒ deps `[id, mediaType, isPaused]` không đổi ⇒ effect không re-fire ⇒ `<video key={id}>` (DOM remount mới, default paused, no `autoPlay`) không được gọi `play()`. Progress bar vẫn chạy vì CSS animation thuần trên mount mới (không qua effect) ⇒ desync. Image không dính (chỉ `<img>`, không cần play). Thêm `isOpen` (false→true) → deps đổi → re-fire → play. Close (true→false): effect chạy nhưng `v=null` (đã unmount) → early return safe.
- **Cron không load-bearing (confirm lại)**: expired story đã bị ẩn bởi time-filter (`expiresAt>now`) trong active query; cron chỉ set cờ cho `/stories/archive`. Miss tick chỉ trễ archive page, không lộ story hết hạn.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[P3] [frontend/story-viewer]` `muted` state KHÔNG reset khi reopen viewer (persist qua close vì component không unmount) — session trước fallback→muted thì reopen giữ muted. Pre-existing, không do fix video-reopen. Reset = `setMuted(false)` trong nhánh `!isOpen` của init effect nếu muốn mute về default mỗi lần mở.

**Next:** Browser re-verify T1-T7 video reopen + T1-T22 4.4 còn lại (user). PASS → commit `feat: stories archive + cron + profile entry + view count (Checkpoint 4.4)` thẳng main (gộp cả 2 bugfix follow-up).

---

## 2026-06-09 — Checkpoint 4.4: Stories archive + cron + profile entry + view count/viewers (Phase 4 core hoàn thành)

**Done (45/45 case PASS = backend smoke 23/23 [API 17 + cron 6] + browser 22/22; migration applied; `tsc` BE/FE + `vite build` 0 lỗi 2013 modules; OpenAPI 27 paths). 3 nhóm features:**
- **Archive + Cron**: cron flip `isArchived` khi story hết 24h + `GET /stories/archive` (own archived, cursor) + `ArchivePage` `/me/stories/archive` (grid 9:16 thumbnail → mở archive viewer). Delete trong archive viewer cập nhật cả grid.
- **Profile Entry**: `GET /users/:username` thêm `hasActiveStory` → avatar profile có ring coral khi có story active, tap mở viewer (single-user mode); self thêm nút "Archive".
- **View Count + Viewers**: `viewCount` owner-only trong Story DTO + badge `👁 N views`; `GET /stories/:id/views` (owner-only) + `StoryViewersModal` (Radix dialog, infinite scroll); viewer pause khi modal mở.
- **2 UX fix (browser verify)**: modal click viewer đóng cả viewer (không chỉ modal); `markStoryViewed` skip self-view (owner KHÔNG vào viewers list/viewCount) + cleanup 12 legacy self-view rows (DB → 0).

**Lưu ý kỹ thuật — 5 pattern engineering mới Phase 4.4:**
- **Cron `setInterval` thuần (0 dep)**: `src/jobs/archiveExpiredStories.ts` + `startArchiveJob()` (5 phút, run-immediately bù downtime, try/catch không crash) wired `server.ts` sau `app.listen`. KHÔNG load-bearing visibility (active query đã time-filter ẩn expired) — cron chỉ set cờ cho archive query đúng; miss tick chỉ trễ cờ.
- **Owner-gate field privacy**: `serializeStory(...,{viewerId})` → `viewCount = isOwner ? _count.views : null`; gate ở BE (non-owner luôn null), feed loại self ⇒ feed luôn null, no leak — KHÔNG chỉ ẩn ở FE.
- **StoryViewer 3-mode branch (extend hybrid dual-source 4.2)**: 1 component, `mode: feed | single-user | archive` quyết `canCrossUserAdvance`/`shouldMarkSeen`/`isOwner`/nguồn-data/init. Archive unreachable qua feed/userStories (cả 2 filter active) ⇒ bắt buộc nguồn thứ 3 `useArchivedStories`; archive mode = no mark-seen (BE reject archived) + no cross-user + isOwner=true.
- **Archive infinite cache patch (storyCache extension)**: archive = `InfiniteData` (pages) ≠ feed/userStories plain object ⇒ `removeStoryFromCaches`/snapshot/restore thêm nhánh map-pages-filter; `useDeleteStory` +`cancelQueries(archivedStories())`.
- **`userProfileSchema` vs `publicUserSelect` tách biệt**: `hasActiveStory` chỉ vào profile DTO (`findFirst` existence + privacy gate), KHÔNG vào 7-field `publicUserSelect` (reuse cho author/list-item) — tránh phình + query thừa.
- (phụ) Route `/stories/archive` đặt **trước** `/:id` (Express order, tránh nuốt làm id); `markStoryViewed` skip-self GIỮ 404 (không đổi 410, nhất quán codebase); BE API `/stories/archive` (auth=me ngầm) ≠ FE page route `/me/stories/archive`; pause-on-modal combine `||` KHÔNG sửa `useStoryGestures` + ESC guard `modalOpenRef`.

**Tech debt phát sinh (ĐÃ append BACKLOG trong session — không append lại):**
- `[P3] [frontend/story-viewer]` Archive auto-advance qua page boundary = fetchNextPage + index++ (spinner ngắn) — không prefetch.
- `[P3] [backend/stories]` viewCount `_count.views` aggregate per row kể cả feed (luôn null non-owner nhưng vẫn chạy aggregate) — tối ưu nếu feed phình.
- `[P3] [stories]` View count không realtime (owner refetch mới thấy) — WebSocket Phase 5.

**Next:** Commit `feat: stories archive + cron + profile entry + view count (Checkpoint 4.4)` thẳng main. Sau đó 4.3b (MENTION/STICKER/TAG + multi-touch) hoặc Phase 5 messaging.

---

## 2026-06-09 — Checkpoint 4.3a: Story overlays builder (TEXT + EMOJI + video edit)

**Done (BE migration + smoke 7/7 + browser verify 42/42 PASS [22 cases gốc + 20 cases extension] + `tsc` BE/FE + `vite build` 0 lỗi, 2009 modules):**
- **Backend (5 files + migration)**: model `StoryItem` (x/y 0-1 normalized, `scale@1`/`rotation@0`, `payload Json`, FK `onDelete Cascade`, `@@index([storyId])`) + `Story.items[]`. Enum `StoryItemType` khai **đủ 5 value** (TEXT/EMOJI/MENTION/STICKER/TAG, phase-commented) nhưng Zod `storyItemInputSchema` (discriminatedUnion) **gate TEXT+EMOJI** → 4.3b thêm case Zod, **KHÔNG enum migration**. `createStorySchema.items` optional `.default([])` (trước `.refine`, 4.1 zero-break); `storyResponseSchema.items`; `storyInclude.items` (select + `orderBy id asc` — cuid monotonic ⇒ z-order ổn); `serializeStory` whitelist +items; `createStory` nested-create. Migration `20260609095111_add_story_items` (cascade FK). OpenAPI **25 paths** (discriminatedUnion → `oneOf` OK).
- **Frontend deps**: `@emoji-mart/react`+`@emoji-mart/data`+`emoji-mart` (~50KB — ngoại lệ có chủ đích "no dep mới"; **ship types sẵn**).
- **Types**: `StoryItemType`/`StoryItem`(discriminated)/`StoryItemInput`(no id); `Story.items`; `CreateStoryInput.items?`.
- **Overlay primitives**: `StoryOverlay` (reuse editor+viewer), `StoryOverlayLayer` (viewer read-only `pointer-events-none`, null khi rỗng), `useOverlayDrag` (**1 hook**, `getHandlers(item)` tránh hooks-in-loop; CropStage setPointerCapture idiom; normalize px→0-1 theo contentRef; tap<5px=select / ≥5px=drag; trash hit ref final pos <0.12), `TrashZone` (bottom-center, visible khi drag + highlight near), `AddTextOverlay`+`EmojiPickerOverlay` (inline `absolute z-50`, **KHÔNG nested Radix Dialog**; ESC/backdrop cancel).
- **`StoryEditStage`** (**image + video**): layout **mirror viewer** (max-w-md, h-20 top + h-20 bottom chrome), bg = `media.blob` objectURL → image `<img object-cover>` / video `<video object-contain bg-black>` paused seek 0.1s (no autoplay, match poster), drag-reposition + drag-trash, tap-(de)select, top chrome X(close)/Back/Share.
- **`StoryComposer`**: step `edit` cho **cả image + video** (`crop→edit→upload` / `video→edit→upload`, cùng StoryEditStage). `editingMedia: StoryMediaPayload`; edit `onBack` conditional (video→`video`/image→`crop`). DialogContent **full-bleed trên edit** (no title bar + bg-black + showClose=false + onEscapeKeyDown preventDefault) → content zone khít viewer.
- **`StoryViewer`**: restructure flex-col chrome zones + `StoryOverlayLayer`. Gesture/progress/mute/swipe/cross-user **giữ nguyên**.
- **`useCreateStory`**: mutate var `{media, items?}`; items vào CreateStoryInput **cả image + video path**.
- **Fix 3 issue + mở rộng video-edit (cùng session, user approve KHÔNG defer)**: (1) **labels** — crop/video stage cuối `Next` (→edit), editor cuối `Share` (→upload+post); (2) **selected ring hug text** — ring chuyển sang inner `inline-block` (shrink content) + `max-w-[80%]` ở outer absolute (giải circular %), TEXT ring sát pill / EMOJI ring-offset-2; (3) **video flow vào edit** — VideoStage→edit (V1 paused first frame, V2 object-contain letterbox), drag overlay trên poster, Share→upload. `vite build` 0 lỗi sau fix.
- **Docs**: backend/CLAUDE.md (StoryItem + endpoint), frontend/CLAUDE.md (Phase 4.3a section + coord rule + video-edit + ring fix), PROGRESS.md (entry này).

**Verify (code-level + backend functional):**
- **Migration applied** `20260609095111_add_story_items` (StoryItem + enum 5-value + FK cascade + index storyId); `prisma generate` OK (dev server lúc đó down → KHÔNG EPERM).
- **Backend smoke 7/7 PASS** (Node fetch trên dev server, backend trust client URL không cần S3): create mix TEXT+EMOJI → 201 + items có id/scale1/rotation0/payload đúng **thứ tự array**; no-items → `[]`; x=1.5 → 400; STICKER → 400 (Zod gate); TEXT thiếu text → 400; delete ×2 → 204 (cascade, không FK error). (Script throwaway, đã xóa.)
- **`tsc -b` BE + FE + `vite build`** 0 lỗi (2009 modules, +10 so 4.2). OpenAPI build 25 paths + Story.items + StoryItem schema + CreateStoryRequest.items = oneOf.
- **Browser-interactive 42/42 PASS**: 22 cases bộ gốc (add text/emoji inline, drag, multi-overlay, trash delete + near-highlight, coord consistency editor↔viewer, backward-compat 4.1 no-items, empty→items[], cancel Back/X, ESC AddText, dark+mobile, regression 4.2 gesture/progress/mute/cross-user) + 20 cases extension (3 UX fix: button labels, ring hug text ngắn/dài/multi-line/emoji, video→edit poster bg drag + viewer playback + coord video editor↔viewer mobile+desktop).

**Lưu ý kỹ thuật:**
- **Pattern 2-layer container (ring sizing fix)**: overlay = outer `absolute` (positioning + drag + transform + `max-w-[80%]` resolve theo content zone) + inner `inline-block` (shrink-wrap content, mang ring). Outer shrink theo inner ⇒ ring hug sát text/pill. Đặt `max-w` ở inner sẽ resolve % sai vs parent shrink-fit (circular) → BẮT BUỘC tách 2 layer.
- **Video bg = paused first frame at 0.1s + object-contain letterbox** (decision): editor `<video muted preload=metadata>` `onLoadedMetadata`→`currentTime=0.1` (match poster của `extractVideoThumbnail`), **KHÔNG autoplay** (CPU free cho drag overlay). object-contain khớp viewer (cả 2 letterbox ⇒ overlay khớp vị trí; portrait không bị crop).
- **Coord consistency**: editor+viewer **same layout** (max-w-md + h-20/h-20 chrome + object-fit per media type) ⇒ overlay 0-1 khớp vị trí. Edit full-bleed (no-title-bar, full-screen desktop) để content zone editor == viewer. Mobile exact; desktop cùng max-w-md width.
- **2 refinement vs E3 pseudocode** (đã chốt khi plan): (1) **symmetric chrome** h-20 cả top+bottom 2 phía (pseudocode lệch auto/h-20) tránh flex-1 khác aspect; (2) **edit full-bleed + bỏ title bar** (Dialog `sm:max-h-[90vh]` + `h-12` title sẽ co/lệch content zone vs viewer).
- **1 hook useOverlayDrag** (getHandlers per item) — KHÔNG reuse `useStoryGestures` (viewer-nav khác concern).
- **discriminatedUnion → oneOf** OpenAPI OK (không cần fallback z.union như plan dự phòng).
- **emoji-mart ship types** (không cần module declaration).
- **StoryItemType enum full-5** DB + Zod-gate-2 → 4.3b zero enum-migration.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[P2] [frontend/lint]` `npm run lint` vỡ config (eslint 9.39.4 `eslint.config.js:15 recommended undefined`) — **pre-existing**, KHÔNG do 4.3a (install chỉ thêm emoji-mart, không bump eslint). tsc+build là nguồn verify; cần sửa eslint.config riêng.
- `[P3] [frontend/story-overlay]` z-order = array order (no `order` field) — add `order` nếu 4.3b cần reorder overlay.
- `[P3] [frontend/story-editor]` Desktop coord lệch nhẹ nếu editor (Dialog full-bleed) vs viewer (fixed inset-0) khác viewport height (cả 2 max-w-md nên width khớp) — exact trên mobile.
- `[P3] [frontend/bundle]` Bundle 1041KB (>500KB warn) — emoji-mart góp ~50KB; cân nhắc dynamic `import()` Picker.
- `[P3] [backend/stories]` BE KHÔNG validate ảnh thật chứa overlay (trust client x/y/payload) — nhất quán "không verify media".

**Next:** Commit 4.3a thẳng main (`feat: story overlays builder — text + emoji + video edit (Checkpoint 4.3a)`). Sau đó 4.3b (MENTION/STICKER/TAG + multi-touch scale/rotate).

---

## 2026-06-09 — Checkpoint 4.2: Story viewer nâng cao (progress bars + gestures + cross-user)

**Done (FRONTEND-ONLY, KHÔNG backend/migration; browser verify 15/15 PASS + `tsc -b` + `vite build` 0 lỗi, 1999 modules):**
- **Progress bars**: `StoryProgressBar`/`StoryProgressBars` (mới) — mỗi story 1 thanh fill tuyến tính qua CSS keyframe `@story-progress` (index.css) + inline `animationDuration`/`animationPlayState`. Active bar `onAnimationEnd → goNext` thay `setTimeout` cũ (nguồn-sự-thật advance). State pending/active/complete theo index.
- **Gestures**: 1 hook `useStoryGestures` (mới) gộp hold-pause (200ms) / swipe-down dismiss (>100px) / tap 1/3÷2/3 — pointer events + `setPointerCapture` (idiom CropStage), overlay `touch-none` z-10 dưới header/mute/close (z-30/40).
- **Cross-user auto-advance**: viewer đọc `useStoriesFeed` items[] làm queue, forward-only + gate `isUnseenFlow` (tap ring đã-xem chỉ xem user đó rồi đóng). Gộp `goNext` (bỏ lặp timer-vs-button của 4.1) + 1 init effect + `initializedRef` guard (sửa race 2-effect của 4.1).
- **Hybrid dual-source (deviation vs plan, user accept)**: FEED mode (cross-user) khi start user có trong feed; SINGLE-USER mode (`useUserStories` fallback, no cross-user) khi không — vá regression composer "View story" (self KHÔNG nằm trong feed → feed-only sẽ mở-rồi-đóng instant). `startInFeed` quyết định nguồn + bật cross-user.
- **Mute toggle** video (mirror PostVideo ref-sync) + **author avatar/username → `<Link>` profile** (header, `onClick={close}` đóng viewer trước navigate). `storyViewerStore` rename `username → startUsername`.

**Lưu ý kỹ thuật:**
- **`initializedRef` guard CRITICAL**: optimistic view-mark mutate `items[]` (storiesFeed cache) → thiếu guard thì init effect re-run giữa chừng → reset index. Guard reset chỉ khi `isOpen` false→true.
- **Progress pause**: class `animate-story-progress` PHẢI giữ cố định, CHỈ đổi `animationPlayState` inline; thêm/xoá class theo isPaused → animation restart từ 0. `animation-play-state:paused` freeze → resume đúng chỗ miễn phí.
- **1 gesture hook (không 2)**: không spread được 2 `onPointerDown` lên cùng element. `finish()` đọc ref (`deltaYRef`/`pausedRef`) không đọc state → tránh stale-closure delta ở pointerup. `onPointerCancel` riêng (cleanup, không nav).
- **Hybrid hệ quả**: feed loại self → `isOwner` Delete chỉ reachable ở single-user mode (self-after-post); `currentStory.author.username` dùng chung cho mark-viewed/delete cả 2 mode (không cần `currentUser`).
- **@keyframes ở index.css** (Tailwind v4 CSS-first, không config.js) cạnh `.scrollbar-hide`; `forwards` giữ 100% trước khi React đổi state (tránh nháy về 0).
- **author Link `onClick={close}` đồng bộ** trong click event, RR navigate cùng event → không race; body-scroll-lock cleanup khi `isOpen` false.

**Tech debt phát sinh (đề xuất BACKLOG — chờ confirm):**
- `[P3] [frontend/story-viewer]` BACKLOG entry "profile-entry-point single-user" hiện uncommitted **partially obsolete**: data-source fallback (useUserStories) ĐÃ làm trong 4.2; còn lại = (a) UI entry point từ profile page mở viewer own-stories, (b) verify cross-user-delete khi user rỗng (vẫn unreachable). Đề xuất rewrite entry.
- `[P3] [frontend/story-viewer]` Bar↔video drift khi video buffer (bar duration = `story.duration` cố định, video playback có thể stutter) — chấp nhận (Option A, bar = nguồn-sự-thật); `onEnded` backup.

**Next:** Commit 4.2 thẳng main (`feat: story viewer advanced — progress/gestures/cross-user`). Sau đó 4.3 (overlays StoryItem) hoặc polish profile-entry-point. Migration 4.1 đã apply (browser verify chạy được data thật).

---

## 2026-06-08 — Checkpoint 4.1: Stories Core (backend + StoryBar data thật + composer slim + viewer)

**Done (migration applied + `tsc` BE+FE + `vite build` 0 lỗi, 1996 modules + backend smoke 26/26):**
- **Backend schema**: model mới `Story` (1 story = 1 media, field media **phẳng trên row**: mediaUrl/mediaObjectKey/mediaType/thumbnailUrl?/thumbnailObjectKey?/duration?/width?/height?, expiresAt, isArchived, KHÔNG child-table) + `StoryView` (`@@id([storyId, viewerId])` + **`viewer User @relation` FULL** parity Like + `@@index([viewerId])`); `User` thêm `stories[]`+`storyViews[]`. **KHÔNG cột visibility** (privacy user-level), **KHÔNG** StoryItem/AudioTrack/audioTrackId (defer 4.3/4.4). 2 index (`[authorId, expiresAt]`, `[isArchived, expiresAt]`). Migration `20260607181546_create_stories` applied (3 FK đều ON DELETE CASCADE).
- **Backend module** `modules/stories/` (schema/service/routes/openapi): `POST /stories` (expiresAt=now+24h), `GET /stories/feed` (following-set + 1 query views Set tránh N+1 + group-by-author + sort unseen-first + hasUnseenStory), `GET /users/:username/stories` (privacy mirror listPostsByUsername + per-story isViewedByMe), `POST /stories/:id/view` (upsert idempotent 204), `DELETE /stories/:id` (owner 403 + S3 cleanup media+poster). `serializeStory` **whitelist** (KHÔNG leak objectKey). Wire server.ts `/stories`, users.routes `/:username/stories`, openapi (register + tag) → OpenAPI build **25 paths** (3.3 là 20, +5).
- **Frontend data layer**: types (`Story`/`StoryFeedItem`/responses/`CreateStoryInput`), queryKeys (`storiesFeed`/`userStories`), `api/stories.ts` (5 method)+barrel, `lib/storyCache.ts` (plain-cache patch: mark viewed/remove/snapshot-restore).
- **Frontend hooks/stores**: `useStoriesFeed`/`useUserStories`/`useCreateStory`/`useViewStory`/`useDeleteStory` + `storyComposerStore`/`storyViewerStore`.
- **Frontend components** `components/story/`: `StoryBar` (EXTRACT khỏi FeedPage, wire data + giữ scroll-arrows), `StoryRingItem` (ring coral unseen / muted seen), `StoryViewer` (hand-rolled `fixed inset-0`, body-scroll-lock + ESC, first-unseen start, tap prev/next, timer 5s ảnh / duration video + onEnded, owner Delete, mark seen), `StoryComposer` slim (select→crop|video→upload→done, no caption) + `SelectStoryStage` (croppable img + mp4 ≤15s, GIF/AVIF reject) + `StoryCropStage` (cropImage utils, 9:16 locked). Reuse `composer/VideoStage`. Mount composer+viewer ở AppLayout. FeedPage dùng `<StoryBar/>` component.

**Lưu ý kỹ thuật:**
- **3 quyết định chốt với user**: (Q1) StoryView `viewer User @relation` FULL ngay; (Q2) composer **build slim mới** KHÔNG reuse PostComposerModal skeleton (chỉ reuse utilities); (Q3) 4.1 cả image + video.
- **Media phẳng trên Story** (không child-table PostMedia-style) — đơn giản hơn Post, vì 1 story = 1 media.
- **serializeStory whitelist từ đầu** — KHÔNG lặp tech-debt leak objectKey của serializePost (spread raw media).
- **Viewer hand-rolled** (không Radix Dialog) để 4.2 gắn gesture; tự lock body scroll + ESC.
- **Video 15s gate frontend-only** (`SelectStoryStage` sau getVideoMetadata); backend trust client (nhất quán "không verify media").
- **Ảnh croppable-only** (jpeg/png/webp) vì force 9:16; GIF/AVIF reject ở composer.
- **storyCache = plain useQuery cache** (`{items}`/`{stories}`), KHÔNG InfiniteData như postCache → patch object trực tiếp.
- **useCreateStory** mirror useCreatePost nhưng single media (image 1 PUT / video 2 PUT 90-10); onSuccess CHỈ invalidate `userStories(me)` (feed loại self).

**Verify:**
- **Migration applied** `20260607181546_create_stories` (Story + StoryView + 3 FK cascade + 3 index); `prisma generate` OK. (Docker daemon down lúc code → chỉ generate; apply sau khi user bật Docker.)
- **Backend smoke 26/26 PASS** (Node script chạy trên dev server + MinIO thật, presign+PUT thật): create image/video, expiresAt+24h, KHÔNG leak objectKey, video-thiếu-thumbnail→400, feed grouped+hasUnseen, follower/non-follower/anonymous, view 204 idempotent + isViewedByMe flip, missing→404, delete non-owner 403 / owner 204, privacy gate đủ 4 nhánh, **MinIO xóa media+video+poster sau delete**. (Script throwaway, đã xóa.)
- **Browser-interactive CHƯA chạy** (chờ user; dev server BE:3000 + FE:5174 đang chạy): StoryBar data thật, composer crop 9:16 / video 15s reject / GIF-AVIF reject, ring seen/unseen, viewer tap/timer/delete + body-scroll-lock, dark+mobile.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[P3] [backend/stories]` Backend KHÔNG validate video duration (15s) — gate chỉ ở client. Phase polish thêm check server-side (cần đọc metadata / trust client metadata field).
- `[P3] [frontend/stories]` Viewer chưa có sound unmute toggle (thử play có tiếng, fail → muted) — UX âm thanh đầy đủ để 4.2.
- `[P2] [frontend/stories]` Viewer auto-advance chỉ trong 1 user (hết → đóng); chuyển sang user kế tiếp + progress-bar animation + gestures → 4.2.
- `[P3] [backend/stories]` Orphan S3 khi upload partial fail (video PUT ok, poster PUT fail) — carry-over pattern từ posts.

**Next:** Browser-interactive verify (user) → commit `feat: stories core (Checkpoint 4.1)` thẳng main. Sau đó 4.2 (viewer nâng cao: progress-bar animation + gestures hold/swipe + auto-advance qua users).

---

## 2026-06-07 — Checkpoint 3.3: Nested comments / replies (Phase 3 hoàn thành)

**Done:**
- **Split endpoints (approach a, IG-style)**: `GET /posts/:id/comments` giờ chỉ trả **ROOT** (`where parentId: null`) + `repliesCount` mỗi item; `GET /comments/:id/replies` (MỚI) lazy-load replies chronological asc. `serializeComment` (mirror `serializePost`) flatten `_count.replies → repliesCount`, KHÔNG leak `_count`. **KHÔNG migration** (parentId/replies + 2 cascade đã có từ Phase 2.3b-1).
- **Flatten-on-create**: `createComment` reassign `parentId = parent.parentId ?? input.parentId` → reply-của-reply tự về root, chain DB tối đa 1 cấp. **Delete đổi permission**: chỉ comment-author (bỏ post-author của 2.3b-1).
- **Routes tách**: tạo `comments.routes.ts` riêng (`GET /:id/replies`, `PATCH /:id`, `DELETE /:id`) mount `/comments`; `GET/POST /posts/:id/comments` ở lại `posts.routes.ts`. 2 pagination schema (`commentListQuerySchema` default 10 / `replyListQuerySchema` default 4). Response cả 2 dùng chung `{ comments, nextCursor }`.
- **Frontend**: `lib/commentCache.ts` (bump repliesCount + append/remove reply + snapshot/restore), `lib/parseMentions.tsx` (@mention → `<Link text-primary>`, lookbehind chặn email), `useReplies`/`useDeleteComment` (mới) + `useCreateComment` refactor (branch root/reply). UI: `RepliesList` (mới, indent + lazy + inline reply form), `CommentItem` refactor (Reply/Delete actions + View/Hide replies toggle + @mention render), `CommentList` lift `replyingTo` + đổi infinite-scroll → "View more comments", `CommentForm` reply mode (prefill + chip + autoFocus tránh id collision), `CommentDeleteConfirmDialog` (chỉ khi root có replies).
- Verify code-level: backend `tsc -b` 0 lỗi + OpenAPI build OK (20 paths, có `/comments/{id}/replies` + `repliesCount` trong Comment schema); frontend `tsc -b` + `vite build` 0 lỗi (1981 modules).

**Lưu ý kỹ thuật:**
- **Wire envelope giữ `{ comments, nextCursor }`** cho cả root lẫn replies (reuse `commentListResponseSchema` + `CommentListResponse`) thay vì `{ items }` như spec — zero churn ở root, `useReplies` mirror `useComments` y hệt.
- **Delete UX 2 nhánh**: reply + root-không-replies → instant optimistic; root CÓ replies → `CommentDeleteConfirmDialog` cảnh báo cascade "deletes N replies" (reuse pattern `DeleteConfirmDialog` của post).
- **post.commentsCount đếm CẢ replies** (backend `_count.comments` không filter parentId) → reply create/delete cũng bump `commentsCount` qua `patchPostInCaches`; root delete trừ `1 + repliesCount`.
- **Reply onSuccess swap-in-place (KHÔNG invalidate)**: replies chronological asc → newest ở trang CUỐI; invalidate sẽ refetch trang đầu (oldest) làm reply vừa gửi biến mất ở thread dài. Fix: `replaceReply` thay temp→real tại chỗ, chỉ fallback invalidate nếu temp không có trong cache. Root vẫn invalidate (newest nằm page 0 nên đúng).
- **`text-coral` không tồn tại** trong theme → @mention dùng `text-primary` (coral = `--primary`).
- **id collision**: `COMMENT_INPUT_ID` chỉ gắn cho MAIN form (`inputId` prop); reply form dùng `autoFocus` (nhiều form cùng lúc, không trùng id).
- **Circular import `CommentItem ↔ RepliesList`** an toàn (binding render-time + type-only `ReplyTarget`).
- **Reply trên 0-reply root**: auto-expand RepliesList rỗng để host form; cancel khi vẫn 0 reply → collapse lại (`handleReplyClose`).

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[P3] [frontend/comments]` Optimistic `post.commentsCount −(1+repliesCount)` khi xóa root dựa repliesCount trong cache — có thể lệch nếu replies thêm server-side ngoài session; reconcile khi refetch tự nhiên.
- `[P3] [frontend/comments]` Edit comment UI chưa làm (backend `updateComment` đã có từ 2.3b-1) — defer.
- `[P3] [frontend/comments]` @mention chưa autocomplete (gõ @ → dropdown) — Phase polish; notifications mention → Phase 7.

**Next:** Browser-interactive verify 3.3 (root list 10 + "View more"; View/Hide replies 4/page; reply trên root & trên reply prefill đúng; @mention click + `email@gmail.com` không parse; delete reply/root-không-replies instant + root-có-replies confirm cascade; post-author KHÔNG xóa được comment người khác; dark + mobile) + backend curl (root only, replies asc, flatten parentId=root, delete 403 cho non-author & post-author). Sau khi PASS → tag `phase-3-complete` (3.1+3.2+3.3).

---

## 2026-06-07 — Checkpoint 3.2: Video upload + playback (+ delete post, private toggle, change visibility)

**Done:**
- **Video upload (1 MP4/post, single-media-only, KHÔNG trộn ảnh)**: presign thêm `video/mp4` + per-type size cap (image 10MB / video 50MB), thumbnail extract client-side (Canvas + `<video>` seek 0.1s, KHÔNG transcode). Composer fork 2 nhánh sau Select: image → crop, video → `VideoStage`. Render `PostVideo` (autoplay-on-scroll muted, object-contain letterbox, mute toggle, duration overlay) wire vào PostCard/PostDetailView/PostsGrid (Play badge).
- **Migration `add_post_media_thumbnail_object_key`**: thêm `thumbnailObjectKey String?` vào PostMedia để `deletePost` xóa cả video lẫn poster S3 (không orphan). Đây là migration DUY NHẤT của 3.2 (các field `thumbnailUrl`/`duration`/enum VIDEO đã có từ Phase 2).
- **Delete post (frontend)**: `useDeletePost` (optimistic remove khỏi feed+userPosts, snapshot/rollback) + `DeleteConfirmDialog` + `PostActionMenu` (⋯ owner-only) wire vào PostDetailView (KHÔNG ở feed card, giống IG). Backend DELETE + S3 cleanup đã có từ 2.3a.
- **Change visibility**: `PostActionMenu` thêm RadioGroup PUBLIC/FOLLOWERS/PRIVATE (radix DropdownMenu) → `useUpdatePost` (patch in-place). Backend PATCH /posts/:id đã accept visibility từ 2.3a.
- **Private account toggle**: `ui/switch` (hand-roll radix) + field `isPrivate` trong `ProfileEditForm`. Backend (`updateProfileSchema.isPrivate` + service spread + gating postsCount/grid) đã sẵn từ 2.5 — frontend chỉ expose UI.
- Verify code-level: `tsc -b` backend + frontend + `vite build` 0 lỗi; Zod schema unit-check 13/13 (per-type cap + video-standalone refine); OpenAPI build OK.

**Lưu ý kỹ thuật:**
- **media.schema tách 2**: `presignRequestBaseSchema` (ZodObject, đăng ký OpenAPI) + `presignRequestSchema` (`.superRefine` per-type cap). Lý do: register ZodEffects (sản phẩm của refine) vào zod-to-openapi rủi ro vỡ spec → giữ OpenAPI thấy ZodObject sạch, validation runtime dùng bản refined. Lỗi size gắn `path:['size']` để surface ở `details.size`.
- **serializePost spread raw `post.media`** (postInclude không `select`) → `thumbnailUrl`/`duration`/`thumbnailObjectKey`/`objectKey` tự có trong response runtime. Hệ quả: chỉ cần persist lúc create + thêm vào type FE + doc schema, KHÔNG đụng serializer. Kèm hệ quả phụ: `objectKey`+`thumbnailObjectKey` leak ra response (xem tech debt).
- **Composer flow DERIVED** (`video ? 'video' : images.length ? 'image' : null`) thay vì state riêng → 2 holder không drift. `VideoStage` re-key `key={video.id}` như CropStage.
- **useCreatePost** `MediaPayload = CroppedImage | VideoMedia` discriminate bằng `contentType==='video/mp4'`. Video = **2 PUT tuần tự** (video 0–90% + poster 90–100%) gộp 1 `MediaInput`. `extractVideoThumbnail` đọc từ blob LOCAL (objectURL) → KHÔNG dính CORS.
- **PostVideo**: `muted` phải sync qua ref effect (React chỉ set `muted` attribute lúc mount, không update). IntersectionObserver threshold 0.5 play/pause; **mỗi instance 1 observer độc lập** (chưa có single-active coordinator). object-contain để video dọc không bị crop (flow video không có bước crop).
- **useUpdatePost / useDeletePost — lệch spec có chủ ý**: cả hai KHÔNG `invalidateQueries(feed)`. useUpdatePost dùng `patchPostInCaches` replace in-place; useDeletePost optimistic remove + giữ `post(id)` tới onSuccess (tránh flash "not found" trên detail đang mở) + navigate ở onSuccess (không lúc confirm) để onError rollback còn chạy được (component chưa unmount). Lý do chung: invalidate feed → refetch → reshuffle + mất scroll (đã chốt ở 2.4b); post của owner vốn không nằm trong feed của owner.
- **Switch + DropdownMenu** hand-roll từ `radix-ui` umbrella (v1.4.3, đã export `Switch`/`DropdownMenu`) — KHÔNG thêm dependency.
- Windows EPERM khi `prisma generate` lúc tsx watch giữ DLL (đã biết từ 2.3b-1) — migrate apply OK, generate phải retry sau khi dev server nhả DLL.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[P3] [backend/posts]` `objectKey` + `thumbnailObjectKey` leak ra response runtime (serializePost spread raw media) — fix bằng media `select` whitelist. (objectKey đã leak từ Phase 2; 3.2 thêm thumbnailObjectKey.)
- `[P2] [frontend/feed]` Single-active-video coordinator: hiện mỗi `PostVideo` tự play khi ≥50% visible → nhiều video phát đồng thời nếu cùng trong viewport. Cần 1 manager cho phát 1 video tại 1 thời điểm.
- `[P3] [backend/video]` Transcode pipeline (BullMQ + ffmpeg) đa resolution + poster server-side — production. Hiện upload MP4 gốc, poster client-extract.
- `[P3] [frontend/video]` Client compress (ffmpeg.wasm) cho video chạm trần 50MB.
- `[P3] [backend/media]` Orphan S3 khi upload partial fail mở rộng sang video 2-PUT (thumbnail PUT fail sau video PUT → video orphan) — carry-over từ 3.1.

**Next:** Browser-interactive verify 3.2 (video upload/playback + delete + visibility + private) + backend curl (presign caps, POST video, DELETE → MinIO xóa cả 2 object) + CORS playback từ MinIO. Sau đó 3.3 (nested comment/reply); tag `phase-3-complete` khi 3.1+3.2+3.3 xong.

---

## 2026-06-06 — Checkpoint 3.1: Multi-image carousel (up to 5 photos)

**Done:**
- Post từ 1 ảnh → **carousel tối đa 5 ảnh**. Backend CHỈ đổi `createPostSchema.media .max(1)→.max(5)` — KHÔNG migration (PostMedia[] + field `order` đã carousel-ready từ Phase 2; `createPost` đã map `order` theo index, `postInclude` đã `orderBy {order: asc}`).
- Composer 5-step refactor single→array: **multi-select upfront + Add more** (IG-style), crop từng ảnh qua `cropIndex` cursor, **shared aspect ratio** khóa từ ảnh đầu (slide không nhảy height), `ImageStrip` reorder ◀▶ + remove X. State container đổi 4 field single → `images: ComposerImage[]` + `cropIndex` + `ratio` lifted.
- `useCreatePost` single→array: upload **tuần tự** N presign+PUT, progress gộp weighted + label "Uploading k/N…". Giữ no-optimistic + onSuccess (KHÔNG đụng feed).
- Render `PostCarousel` mới (CSS scroll-snap, KHÔNG thêm library): `media.length<=1` short-circuit về `PostMedia` (zero regression Phase 2); nhiều ảnh → swipe native + arrows desktop + dots + badge. Wire `PostCard`/`PostDetailView` + badge `PostsGrid`.
- 13 files: backend 1 dòng (`posts.schema.ts`) + 1 JSDoc; frontend refactor (composer 5 file, `useCreatePost`, render 3 file) + 3 file mới (`PostCarousel.tsx`, `composer/ImageStrip.tsx`, `composer/types.ts`).

**Lưu ý kỹ thuật:**
- **CropStage re-key `key={image.id}`** bắt buộc — không re-key thì zoom/offset/previewUrl/vp leak sang ảnh kế (bug tinh vi nhất của refactor cursor).
- **Shared ratio** lift lên container, `ratioLocked = images.some(i=>i.cropped !== null)`; `CropStage` ratio chuyển từ internal `useState` → **controlled props** (`ratio`/`onRatioChange`/`ratioLocked`). Xóa hết ảnh → unlock tự nhiên.
- **GIF/AVIF passthrough = single-only**: giữ framing gốc, không ép được shared ratio → chặn trộn carousel ở `SelectStage` (`currentHasPassthrough || incomingPassthrough && (count>0 || batch>1)`).
- **Carousel feed KHÔNG bọc `<Link>`** (swipe/arrow priority — Link sẽ nuốt gesture); 1 ảnh GIỮ Link tap-to-open. Mở detail carousel qua comment icon. CSS scroll-snap native thay Swiper → 0 dependency mới.
- **Sequential upload (KHÔNG Promise.all)**: progress gộp `((i+filePct/100)/n)*100` chính xác + fail attribution rõ (biết file nào fail).
- `order` derive từ array index lúc submit → reorder/remove bất kỳ lúc nào đều đúng, không cần bookkeeping riêng.

**Tech debt phát sinh (đề xuất BACKLOG, đã append):**
- `[P3] [backend/media]` Orphan S3 cleanup khi multi-image upload partial fail — 1 trong N PUT fail → ảnh đã upload thành orphan (POST /posts chưa chạy); retry re-upload TẤT CẢ (objectKey mới → thêm orphan).
- `[P3] [frontend/composer]` Pointer-drag reorder cho `ImageStrip` (hiện ◀▶ button swap neighbour).

**Verify:** 9/10 — `tsc` backend + `tsc -b` frontend + `vite build` 0 lỗi (1967 modules), functional code-complete. Item thứ 10 (browser-interactive + backend curl 5-media) chờ user test: multi-select cap 5 / chặn ảnh 6 / chặn trộn GIF; crop shared-ratio lock từ ảnh 2; reorder ◀▶ + remove; sequential upload progress + label k/N; carousel swipe mobile / arrows desktop / dots / badge; **regression 1-ảnh** không chrome; dark + mobile.

**Next:** Browser verify → done. Sau đó Phase 3.2 (video) + 3.3 (nested comment/reply); tag `phase-3-complete` khi cả 3 sub-phase xong (KHÔNG tag bây giờ).

---

## 2026-06-06 — Checkpoint 2.5: Follow button + Profile counts + public profile route

**Done:**
- **Backend**: `GET /users/:username` từ 7-field public → **ProfileUser DTO** (+ `postsCount/followersCount/followingCount` + `isFollowing: boolean|null`). Rename `getUserByUsername` → `getUserProfile(username, viewerId?)` (gắn `optionalAuth` vào route). Reuse `isFollowing()` helper (2.3b-1) + mirror visibility gating của `listPostsByUsername`. Schema riêng `userProfileSchema` (tách khỏi self `userPublicSchema` có email). KHÔNG migration (Follow đã đủ index 2 chiều).
- **Frontend types**: thêm `ProfileUser` (extends `PublicUser`) + `ProfileResponse`. `PublicUser` GIỮ 7 field (không phình — vẫn là post/comment author + list item).
- **Hooks** `features/users/`: `useUserProfile` (`useQuery` + `select` unwrap, cache giữ envelope để patch). `followMutation` engine (mirror `likeMutation`) → `useFollow`/`useUnfollow`: optimistic toggle `isFollowing` + `followersCount ±1`, rollback `onError`, **invalidate `user(username)` onSettled** reconcile count (follow response chỉ `{ following }`).
- **UI**: `FollowButton` (Follow coral / Following outline → hover Unfollow đỏ / pending disabled). `ProfileEditForm` extract ra component riêng. `UserProfilePage` merge từ `ProfilePage` (xóa file cũ): 1 component handle self (Edit profile) + other (FollowButton), stats THẬT qua `formatNumber`.
- **Routing**: `/users/:username` (public profile) + `/profile` → `ProfileRedirect` (→ `/users/<me>`). Author (avatar + @username) ở `PostCard`/`PostDetailView`/`CommentItem` → `<Link>` profile → giải tech-debt 2.4b (author chưa clickable) + làm Follow reachable in-app.

**Lưu ý kỹ thuật:**
- **Circular import** `users.service` ↔ `follows.service` (follows import `publicUserSelect`, users import `isFollowing`): an toàn vì cả 2 dùng ở call-time, KHÔNG top-level — pattern y hệt `posts.service` đang chạy ổn.
- **postsCount = mirror grid** (chốt khi plan): private account + non-owner + non-follower → **0** (giống `listPostsByUsername` trả empty), KHÔNG đếm PUBLIC trơ — tránh "header ghi N posts nhưng grid trống". Owner: cả 3 visibility; follower: PUBLIC+FOLLOWERS; ngoài: PUBLIC.
- **isFollowing = null** cho anonymous HOẶC self → FollowButton chỉ render khi `!== null` + `!isSelf`. isSelf dùng `me.username === username` (rõ hơn dựa null).
- **Count reconcile**: follow response KHÔNG kèm count (khác like) → optimistic + invalidate `onSettled`. Profile 1 fetch nhẹ, không mất scroll.
- **Follow scope hẹp**: chỉ patch `user(username)` cache; KHÔNG đụng feed → `post.isFollowingAuthor`/feed membership stale tới refetch tự nhiên (chấp nhận, ngoài scope).

**Tech debt giải quyết:** followers/following placeholder `0` (2.4c), public profile route `/users/:username` chưa có (2.4b), author name chưa clickable (2.4b) — cả 3 DONE.

**Verify:** Backend e2e curl PASS — isFollowing null/false/true, followersCount tăng đúng, không lộ email; postsCount self=2 (all), non-follower public=1 (PUBLIC), non-follower private=0 (mirror grid), follower=2 (PUBLIC+FOLLOWERS). `tsc -b` backend + frontend + `vite build` 0 lỗi. **Browser-interactive chờ user test** (redirect /profile, self vs other, follow optimistic + rollback offline, dark/mobile).

**Next:** Browser verify → commit. Sau đó cân nhắc followers/following list pages (2.6) hoặc tag `phase-2-frontend-complete`.

---

## 2026-06-04 — Checkpoint 2.4c: Post composer (5-step modal) + Profile real posts grid

**Done:**
- Post composer 5-step modal (`Select → Crop → Caption → Upload → Done`), Zustand `composerStore` global (3 trigger: Sidebar Create, BottomNav Create, Profile empty-state), render 1 instance ở `AppLayout`. Hand-roll, KHÔNG thêm dependency.
- Crop UI hand-rolled bằng Canvas API + pointer events (KHÔNG dùng library): cover-fit base scale × zoom + drag-reposition, 3 aspect ratio (1:1 / 4:5 / 1.91:1), export `canvas.toBlob` (≤1080w, quality 0.9). Geometry tách `lib/cropImage.ts` (pure), interaction ở `CropStage.tsx`.
- `useCreatePost` orchestrate presign → PUT (progress) → POST /posts; `onSuccess` seed `post(id)` cache + invalidate `userPosts(me.username)`. CỐ TÌNH không đụng feed cache (feed = following-only, post của mình không thuộc feed mình).
- ProfilePage refactor: posts grid thật qua `useUserPosts` (`PostsGrid` 3-col, hover overlay like/comment count, infinite scroll), posts count thật. Empty state → CTA "Create your first post" mở composer.
- Client media validation MATCH backend exact (5 MIME + 10MB) chạy TRƯỚC presign (`lib/image.ts validateMediaFile`), tránh waste API call. Error tiếng Anh.
- Bug fix (routing, mobile): `PostDetailPage` nút Back `navigate('/')` → `navigate(-1)` — page mode mobile vào từ profile click post, Back giờ về đúng trang nguồn thay vì luôn về Feed.

**Lưu ý kỹ thuật:**
- **contentType threading** (rủi ro #1): giá trị MIME phải khớp 3 chỗ — `mediaApi.presign({contentType})`, `Content-Type` của PUT (wrap blob thành `File` đúng type), và blob thực. Crop PNG→JPEG ⇒ presign + upload đều `image/jpeg`, KHÔNG `image/png`; nguồn WebP giữ `image/webp`. Lệch → S3 từ chối signature.
- **GIF/AVIF passthrough**: gated bằng `PASSTHROUGH_MIME`, KHÔNG qua canvas (re-encode mất animation GIF + AVIF decode không ổn định) → upload file gốc, chỉ đo dimensions. Croppable (jpeg/png/webp) mới qua canvas.
- **width/height đo client-side** (`getImageDimensions` createImageBitmap + fallback `Image()`) → gửi `media[].width/height` để feed/grid render đúng aspect (clamp [0.8, 1.91] đã có từ 2.4b). Crop output dùng `canvas.width/height`.
- **Không optimistic post**: khác like/comment, post mới chưa có real id/url khi submit → reconcile temp-id trong cursor list dễ vỡ. Chỉ invalidate sau success (theo pattern `useCreateComment.onSuccess`).
- Composer mobile full-screen (`h-[100dvh] max-w-none rounded-none` < sm), reuse shell `ui/dialog` (Radix lo focus-trap/ESC/overlay) như `PostDetailModal`.
- **Step 0 doc-sync**: `CLAUDE.md` Git workflow rule đổi "luôn qua feature branch" → "commit thẳng main (solo dev)" cho khớp reality 2.4a (các checkpoint đã commit thẳng main). Sửa luôn dấu vết "feature branch" stale ở PROGRESS.md entry 2.4b.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[frontend/profile]` followers/following count = `0` placeholder (backend chưa có total-count endpoint, chỉ list cursor). Posts count cũng là loaded-count + "+" khi còn page, không phải total thật. Defer Phase 2.5 (cần count API).
- `[frontend/composer]` Đóng modal giữa lúc upload (`phase=uploading`) chỉ abort PUT ngầm, không confirm — orphan S3 object có thể phát sinh (best-effort storage, acceptable). Cân nhắc confirm-before-close.
- `[frontend/profile]` Public profile route `/users/:username` vẫn chưa có (tech debt 2.4b) — ProfilePage còn own-profile only.

**Verify:** 11/11 functional PASS (T1-T11: 3 trigger mở modal, validate reject sai MIME/>10MB không gọi presign, crop 3 ratio + drag/zoom, back/next giữ-clear state, submit presign→PUT→POST đúng thứ tự + contentType khớp, grid update + count +1, view post pre-seeded, error retry không post ma, dark mode + mobile full-screen, GIF passthrough còn animation, object-URL leak revoke). Bug routing mobile fixed + verify. `tsc -b` + `vite build` 0 lỗi.

**Next:** Phase 2.5 — follow button + `useFollow`, edit/delete comment, public profile route `/users/:username`, followers/following count API. Sau đó tag `phase-2-frontend-complete`.

---

## 2026-06-03 — Checkpoint 2.4b: Frontend posts UI (feed + PostCard + PostDetail + like/comment)

**Done:**
- Frontend Phase 2.4b: feed thật (`useFeed` infinite + IntersectionObserver sentinel), `PostCard`, `PostDetail` mở **modal trên desktop / full page trên mobile + direct URL** (background-location). Refactor `HomePage` → `FeedPage` (giữ StoryBar placeholder Phase 1C, xóa PostCard local + POSTS hardcode). Hand-roll, KHÔNG thêm dependency.
- Mutation layer optimistic: `useLikePost`/`useUnlikePost` (toggle + reconcile authoritative count ở `onSuccess`, KHÔNG invalidate feed), `useCreateComment` (optimistic prepend + bump count + `onSuccess` invalidate). Helper `lib/postCache.ts` patch 1 post trên CẢ 3 cache (`post`/`feed`/`userPosts`) qua 1 cửa + snapshot/restore cho rollback.
- UI primitives hand-roll: `ui/dialog` (từ `radix-ui` umbrella) + `ui/skeleton`; common `Avatar`/`Spinner`/`EmptyState`/`ErrorState`; hooks `useInfiniteScroll` + `useIsDesktop`; `lib/format` (relative time + compact number + aspect-ratio clamp [0.8, 1.91]).
- Bugfix (privacy): logout KHÔNG clear React Query cache → login user B thấy feed/cache user A vài giây trước refetch (rò rỉ private tiềm năng). Fix: `authStore.logout()` gọi `queryClient.clear()`.
- UX change: comment order đảo **ASC → DESC (newest-first)** cả backend (`comments.service` orderBy desc) + frontend (optimistic **prepend** vào `pages[0]`); comment mới hiện ngay đầu list không cần scroll.
- UX change: like/comment count chuyển sang **cạnh icon** (`♥ 13.8K  💬 42`, `tabular-nums`), bỏ dòng "X likes" + link "View all comments" riêng dưới.

**Lưu ý kỹ thuật:**
- `patchPostInCaches`: `userPosts` cache key có username động → match bằng **predicate** (`['users', *, 'posts']`), KHÔNG addressable bằng exact key. `mapPostInInfinite` trả về CÙNG reference khi post không đổi → tránh re-render thừa toàn feed.
- Like flow CỐ TÌNH KHÔNG invalidate feed ở `onSettled`: invalidate → refetch `GET /feed` → reshuffle thứ tự + mất scroll + flicker. Chỉ dựa optimistic + `likesCount` authoritative từ response.
- `radix-ui` là gói gộp (`button.tsx` đã `import { Slot } from "radix-ui"`) → Dialog lấy qua `import { Dialog } from "radix-ui"`, KHÔNG cần thêm `@radix-ui/react-dialog`. shadcn `Input` (React 18) KHÔNG forward ref → comment icon focus input qua `id` (`COMMENT_INPUT_ID`) thay ref.
- Comment order đảo: đổi `orderBy asc→desc` KHÔNG cần sửa cursor logic (Prisma `cursor + skip:1` đi theo orderBy: page sau = comment cũ hơn) + KHÔNG migration.
- `authStore` import `queryClient` an toàn (acyclic — `queryClient.ts` chỉ import `@tanstack/react-query`). Path 401-refresh-fail trong axios interceptor cũng gọi `logout()` → cũng clear cache.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[frontend/post]` Author name/avatar trong PostCard + PostDetail CHƯA clickable (route `/users/:username` public profile chưa có) — wire khi làm profile page 2.4c.
- `[frontend/feed]` Chưa dedupe post `id` khi `flatMap` các page infinite — nếu cursor backend trả trùng (post chèn giữa lúc paginate) → duplicate React key. Cân nhắc dedupe theo id.
- `[frontend/post]` Share/Save (PostActions) vẫn disabled placeholder — wire Phase sau.

**Next:** Commit 2.4b (commit thẳng main) sau khi verify browser-interactive (feed/like/comment/modal desktop+mobile/dark mode/logout-switch-user/comment newest-first). Sau đó 2.4c: follow button + `useFollow`, create-post composer (presigned upload UI), profile real posts grid, edit/delete comment.

---

## 2026-06-02 — Checkpoint 2.3b-1: Follow + Like + Comment (backend, phiên 1/2)

**Done:**
- Schema: 3 model mới `Follow`/`Like`/`Comment` + relations vào `User`/`Post`; migration `add_follow_like_comment`. Comment Phase 2 KHÔNG enum content (luôn text), `parentId` lưu DB nhưng UI hiển thị flat.
- Module `follows`: follow/unfollow idempotent (upsert / deleteMany), self-follow → 400; `followers`/`following` cursor pagination; `isFollowing()` export cho phiên 2 reuse. Routes gắn vào `users.routes.ts` theo `:username` (đồng bộ codebase, không theo `:id` của ARCHITECTURE §4).
- Module `likes`: like/unlike idempotent → `{ liked, likesCount }`; like gated visibility (post không thấy → 404), unlike luôn cho phép (retract own data). Tách helper `getViewablePost()` (gate visibility 404-over-403) vào `posts.service` để dùng chung.
- Module `comments`: CRUD; list oldest-first (`createdAt asc`, IG-style); delete cho comment-author HOẶC post-author. Route split 2 router trong CÙNG `posts.routes.ts`: default (`/posts/:id/comments`) + `commentsRouter` named export (`/comments/:id`), mount `/comments` riêng ở server.ts.
- Privacy gate `followers`/`following`: `optionalAuth` + helper `canViewSocialList` — account private chỉ owner + follower xem list, còn lại (kể cả anonymous) → empty.
- Wiring: `openapi.ts` registerAll + 3 tag (Follows/Likes/Comments). `tsc -b` pass 0 lỗi. Code-complete, CHƯA commit — chờ test thủ công 20 + 2 bước (privacy) trước khi sang phiên 2.

**Lưu ý kỹ thuật:**
- Comment route placement: posts router mount tại `/posts` nên KHÔNG đẻ được absolute `/comments/:id` từ 1 router → giải bằng 2 router cùng file (default + `commentsRouter` named export), mount tách `/comments` trong server.ts.
- Follow relation naming ngược trực giác (theo ARCHITECTURE §3): `followers @relation("following")`, `following @relation("follower")`. Quy chiếu: "ai follow tôi" = `where { followingId: me }`; "tôi follow ai" = `where { followerId: me }`.
- Cursor `followers`/`following` = userId cạnh biến (`followingId`/`followerId` cố định) qua composite cursor `followerId_followingId` — KHÁC cursor `(createdAt, id)` của post/comment list.
- `getViewablePost` dùng chung likes + comments (và `getPostById` ở phiên 2) — đảm bảo nhất quán 404-over-403 cho read private.
- Windows: `prisma generate` fail `EPERM` (rename `query_engine-windows.dll.node`) khi `npm run dev` (tsx watch) đang giữ DLL → phải tắt dev server trước khi generate.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[backend/build]` `tsc -b` sinh `backend/tsconfig.tsbuildinfo` (đang untracked trong git) — thêm vào `.gitignore`, không commit build artifact.

**Next:** Sau khi user test 20 + 2 bước PASS → phiên 2 (2.3b-2): posts refactor (`postInclude` thành function + `serializePost`: likesCount/commentsCount/isLikedByMe/isFollowingAuthor; follow-check thật cho `getPostById` + `listPostsByUsername`) + module `feed` (`GET /feed`, 14 ngày, shuffle client-side) + wiring + docs (CLAUDE.md endpoints, phase status).

---

## 2026-06-01 — Checkpoint 2.3a: Posts module backend (Post + PostMedia, CRUD)

**Done:**
- Prisma: thêm `Post`, `PostMedia`, enum `PostVisibility`/`MediaType`, relation `User.posts`; migration `add_posts_and_media`.
- Module `posts/` (schema/service/routes/openapi): `POST /posts` (ảnh và/hoặc caption, refine ít nhất 1), `GET /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id`, nested `GET /users/:username/posts` (cursor pagination, đặt trong users.routes gọi posts.service).
- Middleware `optionalAuth` mới (verify token nếu có, không 401 nếu thiếu) cho route public cần biết viewer; export `publicUserSelect` từ users.service reuse cho `author` (không lộ email/passwordHash).
- Visibility: PUBLIC ai cũng xem; PRIVATE/FOLLOWERS read bởi non-owner → 404 (giấu existence); write (PATCH/DELETE) non-owner → 403; account private list → empty (follow thật để 2.3b).
- `deletePost` xóa object S3 best-effort (`DeleteObjectCommand` từng key, fail thì log không throw); KHÔNG verify file tồn tại khi tạo post (tin client).
- Bugfix cùng session: 2 GET dùng optionalAuth thiếu `security` trong OpenAPI → Swagger UI không gửi bearer → owner xem post PRIVATE bị 404. Fix bằng `security: [{ bearerAuth: [] }, {}]`.

**Lưu ý kỹ thuật:**
- Endpoint optional-auth PHẢI khai `security: [{ bearerAuth: [] }, {}]` trong OpenAPI thì Swagger UI mới đính token (phần tử `{}` rỗng giữ anonymous vẫn hợp lệ). Thiếu → Swagger không gửi header dù đã Authorize → `req.user` undefined. Đây là root cause bug owner-404.
- Cursor pagination: `take limit+1` để phát hiện `hasMore`, `cursor: { id }, skip: 1`, `orderBy [createdAt desc, id desc]`; `nextCursor` = id item dư.
- 404-over-403 cho read private (giấu existence), giữ 403 cho write — nhất quán pattern bảo mật.

**Tech debt phát sinh:** (đề xuất, chờ confirm) xem mục dưới.

**Next:** Checkpoint 2.3b — Follow/Like/Comment models + Feed (follow + shuffle); refactor visibility FOLLOWERS dùng follow check thật.

---

## 2026-06-01 — Checkpoint 2.1: MinIO infrastructure (chưa code feature)

**Done:**
- Thêm service `minio` vào `backend/docker-compose.yml` (image `minio/minio:latest`, ports 9000 API / 9001 console, creds dev `minio`/`minio12345`, healthcheck `mc ready local`) + volume `minio_data`.
- Thêm 6 S3 env vars vào `.env.example` (`S3_ENDPOINT/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET/PUBLIC_URL`).
- Cập nhật `backend/CLAUDE.md` section Storage: service name, creds default, access model (bucket public-read cho đọc, presigned PUT cho upload).
- Verify hạ tầng qua console UI: tạo bucket `social-media-media`, set public-read, upload + share URL OK.

**Lưu ý kỹ thuật:**
- Bucket MinIO mặc định private → share URL trả 403. Phải set Access Policy public-read (prefix `*`, readonly) thủ công sau khi tạo bucket. Access model chốt: **đọc** ảnh qua `S3_PUBLIC_URL` trực tiếp (không sign, giảm latency feed), **upload** mới qua presigned PUT.
- `.env.example` bị permission settings chặn đọc/ghi (match `.env*`) → Claude không Edit được, user paste tay snippet.
- Postgres map host port 25432→5432; MinIO map thẳng 9000/9001.

**Tech debt phát sinh:** `[backend/storage]` creds MinIO hardcode trong docker-compose (dev only) → BACKLOG. (Automate MinIO setup đã có sẵn trong BACKLOG.)

**Next:** Checkpoint 2.2 — cài `@aws-sdk/client-s3` + `s3-request-presigner`, tạo `lib/s3.ts`, module `media/` với `POST /media/presign`, validate S3 vars trong `config/env.ts`.

---

## 2026-05-30 — Frontend Phase 1B: Design system "Beng" + layout shell + dark mode

**Done:**
- Override toàn bộ shadcn token Nova (zinc base, primary tím) → warm-neutral + coral trong `index.css` (`:root` + `.dark`, oklch hue 32–60, radius 0.625→0.75). 5 component shadcn (button/card/input/form/label) tự đổi theme, không rewrite.
- Đổi font: gỡ `@fontsource-variable/geist` → Bricolage Grotesque (heading) + Plus Jakarta Sans (body) qua Google Fonts.
- Dark mode JS layer: `themeStore` (Zustand persist key `theme`), `useThemeEffect` (toggle `.dark` trên `<html>`), `ThemeToggle`, FOUC inline script trong `index.html`.
- Layout shell mới (`components/layout/`): `AppLayout` (Sidebar | main | RightRail + BottomNav mobile), `AuthLayout` (split coral panel); lồng vào guard route trong `App.tsx`.
- 4 page restyle giữ nguyên logic auth/validation/mutation: Login/Register vào AuthLayout; Home bỏ header + `useQuery` orphan → story bar + feed placeholder; Profile header + stats + posts grid.
- Story bar IG-style: `scrollbar-hide`, ~6 story/view, arrow hover-show + auto-hide theo `canScrollLeft/Right`, scroll đo runtime (`offsetWidth` + `gap` × 3 item) thay px hardcode.

**Lưu ý kỹ thuật:**
- Token override đủ restyle vì cả 5 shadcn component 100% semantic token, không hardcode màu (verify trước khi sửa).
- `--destructive-foreground` thêm vào `:root`/`.dark` + map `--color-destructive-foreground` trong `@theme inline`, nhưng button destructive đang dùng style subtle (`bg-destructive/10 text-destructive`) nên chưa đổi visual — token để sẵn.
- FOUC script đọc `stored.state.theme` (Zustand persist bọc `{state,version}`), không phải `stored.theme`.
- Story scroll step đo item đầu `[data-story-item]`; cân bằng your-story `size-17` (68px) khớp story thường (ring 64+4=68) + `gap-6.5` để tránh drift, thay vì đo riêng item normal.
- AppLayout/AuthLayout lồng trong ProtectedRoute/PublicOnlyRoute (cả hai render `<Outlet/>`).

**Tech debt phát sinh (đề xuất append BACKLOG):**
- `[frontend/a11y]` ThemeToggle đổi `<Button>` → `<div onClick>`: mất button semantics, keyboard access (Tab/Enter/Space) và focus ring. Revert về `<button>` hoặc thêm `role="button"`/`tabIndex`/`onKeyDown`.
- `[frontend/layout]` Story bar `useEffect` init chỉ chạy lúc mount, không re-check khi resize → `canScrollRight` có thể stale khi đổi viewport. Cân nhắc `ResizeObserver`.
- `[frontend/nav]` Nav placeholder (Search/Explore/Reels/Messages/Notifications/Create/Settings) đang disabled visual, chưa có route — Phase 2+ wire route thật.

**Next:** Verify browser-interactive (light/dark/mobile, FOUC reload, story scroll trọn item). Sau đó Phase 2 — posts (model + API + feed thật).

---

## 2026-05-28 — Frontend Phase 1A: Foundation

**Done:**
- Scaffold Vite + React + TS trong `frontend/`, path alias `@` → `src/`, shadcn init (preset Nova, Tailwind v4 CSS-first)
- axios client với request interceptor (gắn Bearer) + response interceptor (401 → refresh → retry; refresh fail → `logout()`)
- Zustand `authStore` (persist localStorage), TanStack Query (QueryClient + Provider + DevTools dev-only)
- React Router 6: `ProtectedRoute` + `PublicOnlyRoute`, 4 page placeholder (`/login`, `/register`, `/`, `/profile`)
- `types/api.ts` viết tay khớp response backend; `HomePage` có `useQuery(['me'])` smoke test
- Verify code-level pass: `tsc -b` + `npm run build` 0 lỗi; contract API khớp (register/login `identifier`/me Bearer/refresh) qua curl. 3 bước browser-interactive chờ test thủ công.

**Lưu ý kỹ thuật:**
- create-vite latest kéo React 19 + Vite 8 (rolldown) + TS 6 → pin cứng về **React 18 + Vite 5 + TS 5.6 + React Router 6**. Vite 8 rolldown vỡ trên Node 22.1.0 (thiếu native binding `@rolldown/binding-win32-x64-msvc`, cần Node ≥22.12).
- Tailwind v4 = CSS-first: KHÔNG có `tailwind.config.js`, theme nằm trong `src/index.css` qua `@theme`, color space oklch (zinc base).
- shadcn init thêm `@import "shadcn/tailwind.css"` vào index.css nhưng package `shadcn` chỉ là CLI (đã gỡ khỏi deps) → phải xóa import đó nếu không build fail.
- TS 5.6 không biết `erasableSyntaxOnly` (option TS 5.8+) → gỡ khỏi tsconfig.app/node.
- Interceptor dùng refresh-promise singleton cho concurrent 401; KHÔNG redirect trong axios (chỉ `logout()`, ProtectedRoute tự redirect).

**Tech debt phát sinh (đã append BACKLOG):**
- `[frontend/auth]` Token lưu localStorage → XSS đọc được; Phase polish chuyển refresh token sang httpOnly cookie.

**Next:** Phase 1B — UI auth form thực (react-hook-form + Zod, login/register/profile), `npx shadcn@latest add` các component v4. Nâng Node lên ≥22.12 để bỏ warning Vite.

---

## 2026-05-27 — Swagger UI schema-first (Zod → OpenAPI)

**Done:**
- Tích hợp `@asteasolutions/zod-to-openapi` + `swagger-ui-express`, serve `/docs` và `/docs/json` (dev-only gate qua `NODE_ENV`)
- `lib/openapi.ts` làm registry trung tâm + `extendZodWithOpenApi(z)` + security scheme `bearerAuth` + shared schemas (`User`, `Error`, `ValidationError`)
- 3 file `*.openapi.ts` per-feature (auth, users, health/Meta) đăng ký paths từ Zod schema gốc, không sửa `*.schema.ts`
- Tags array document-level cố định thứ tự Auth → Users → Meta
- Verify 9/9 pass: spec valid, $ref dùng đúng, refresh-token-as-access trả 401, prod mode `/docs` 404

**Lưu ý kỹ thuật:**
- Pin `@asteasolutions/zod-to-openapi@^7.3.0` — v8 latest peer-deps Zod ^4 (project đang Zod 3.23)
- Circular import `lib/openapi` ↔ `modules/*/openapi` (registry export schema + paths import lại schema) → giải bằng lazy `require()` trong `registerAll()`, không bằng dynamic ESM import (tsx CJS context)
- `servers` URL và log dùng `localhost` thay `env.HOST` vì HOST mặc định `0.0.0.0` không gọi được từ browser
- Path params phải dùng cú pháp OpenAPI `{username}`, không reuse Express `:username`

**Tech debt phát sinh (đề xuất append vào BACKLOG.md):**
- JWT verify error message gộp chung: refresh-token-as-access và expired-token đều trả `"Token không hợp lệ hoặc đã hết hạn"` — nên phân biệt `TokenTypeMismatch` vs `TokenExpired` ở `lib/jwt.ts` để client biết retry-with-refresh hay buộc re-login
- `userPublicSchema` trong `lib/openapi.ts` đang duplicate field list với `publicUserSelect` của Prisma — khi thêm field mới (vd `followersCount`) phải sửa 2 chỗ; cân nhắc derive từ Prisma type sau khi có generator
- `buildOpenApiDocument()` chạy 1 lần khi mount — nếu cần hot-reload paths trong dev cần chuyển sang gọi mỗi request `/docs/json` (chi phí thấp)

**Next:** Đợi xác nhận để append BACKLOG. Sau đó Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router), có thể dùng `/docs/json` để auto-gen types.

---

## 2026-05-26 — Backend Phase 1 hoàn thành

**Done:**
- Auth flow đầy đủ (register/login/refresh/me/logout) + JWT type-aware
- Users module (GET /:username, PATCH /me)
- Prisma migration init, model User
- Middleware: auth/validate/asyncHandler/error
- Swagger UI tại /docs (dev-only), OpenAPI 3.1 spec
- 9/9 verify pass (xem PR/commit)

**Lưu ý kỹ thuật phát sinh:**
- Pin zod-to-openapi ^7.3.0 (v8 yêu cầu Zod 4, không tương thích Zod 3.23)
- Circular import lib/openapi ↔ modules/*/openapi → giải bằng lazy require trong registerAll()
- Schema User extract về lib/openapi.ts (dùng chung 2 module)

**Tech debt nhỏ:** Xem `BACKLOG.md` — JWT error message gộp chung mọi case fail.

**Next:** Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router)

---