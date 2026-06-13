import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';

/**
 * Phase 5.2 — Socket.io handshake authentication. The client passes its JWT in the handshake
 * `auth.token` field (the realtime parallel of the REST `Authorization: Bearer` header); we
 * verify it with the same lib/jwt helper and stamp the socket with the user identity for every
 * subsequent event. An invalid/missing token rejects the connection (client gets connect_error).
 *
 * Note: this validates ONCE, at handshake. A token expiring mid-connection does not drop the
 * socket; the client re-authenticates with a fresh token on reconnect (see useSocketConnection).
 */
export function socketAuth(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Unauthorized'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    socket.data.userId = payload.sub;
    socket.data.username = payload.username;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}
