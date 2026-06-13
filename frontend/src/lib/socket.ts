import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

// Phase 5.2 — singleton Socket.io client (mirrors the apiClient axios singleton). One connection
// per tab; its lifecycle is owned by useSocketConnection (connect on auth, disconnect on logout).
//
// The JWT is read FRESH from the auth store before every (re)connection attempt via the `auth`
// callback. So a token refreshed by the axios interceptor (which keeps the store token current)
// is picked up automatically on the next reconnect — that's how mid-connection token expiry is
// handled, without a separate socket-side refresh path.

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(baseURL, {
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? '' }),
    transports: ['websocket'],
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
