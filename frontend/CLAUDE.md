# Frontend — Project Memory

> Frontend chưa được build. File này thiết lập rules SẼ áp dụng khi bắt đầu code.

## Stack đã chốt

- **Build tool**: Vite (KHÔNG Next.js, KHÔNG CRA)
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS — utility-first
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

### Tailwind
- Custom theme trong `tailwind.config.js` cho colors/fonts của project
- KHÔNG arbitrary values lung tung (`bg-[#abcdef]`) — define trong config nếu dùng nhiều lần
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

## Phase 1 deliverables (chưa build)

- [ ] Setup project: Vite + React + TS + Tailwind
- [ ] Axios client + interceptor (auto refresh)
- [ ] Zustand authStore
- [ ] TanStack Query setup
- [ ] React Router với protected routes
- [ ] Trang `/login`
- [ ] Trang `/register`
- [ ] Trang `/` (home, hiện tên user)
- [ ] Trang `/profile` (xem + sửa)
- [ ] Logout button (clear store + redirect login)
