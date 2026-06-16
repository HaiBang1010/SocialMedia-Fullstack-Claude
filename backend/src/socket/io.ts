import type { Server } from 'socket.io';

/**
 * Phase 5.2 — singleton Socket.io server ref, set once by initSocket at startup.
 *
 * Kept in its own tiny module (mirroring lib/prisma.ts) so service code can import the emit
 * helpers WITHOUT importing the socket bootstrap (which pulls in prisma/auth/rooms). The
 * dependency is one-way — messages.service → io.ts — so there is no import cycle. socket.io is
 * a type-only import here; this module has no runtime dependency on the socket.io package.
 */
let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.io has not been initialised');
  return io;
}

// Room name helpers — one room per user (joined on connect) and per conversation (joined when
// the thread is open). See src/socket/index.ts for who joins what.
export const userRoom = (userId: string) => `user:${userId}`;
export const convoRoom = (conversationId: string) => `convo:${conversationId}`;

// Every emit helper no-ops when io is unset (pre-init / tests) so callers don't need a guard.

/** Broadcast a newly-persisted message to each participant's user room (D1: send stays REST,
 * the socket only fans the result out). Reaches the sender's OTHER tabs too — clients dedup
 * by message.id. `message` is the already-serialized DTO. */
export function emitNewMessage(
  conversationId: string,
  message: unknown,
  participantIds: string[],
): void {
  if (!io) return;
  for (const userId of participantIds) {
    io.to(userRoom(userId)).emit('message:new', { conversationId, message });
  }
}

/** Broadcast a reaction change to each participant's user room (Phase 5.3a, D5/D6). The payload
 * is a DELTA: emoji is the new emoji, or null when the reaction was removed. Reaches the actor's
 * own tabs too (clients reconcile by userId). `reaction.userId` is who reacted. */
export function emitMessageReaction(
  conversationId: string,
  messageId: string,
  reaction: { userId: string; emoji: string | null },
  participantIds: string[],
): void {
  if (!io) return;
  for (const userId of participantIds) {
    io.to(userRoom(userId)).emit('message:reaction', {
      conversationId,
      messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
    });
  }
}

/** Broadcast a recall (soft-delete) to each participant's user room (Phase 5.5). The payload is
 * a delta — the client patches its cached message into a "Message deleted" tombstone. Reaches the
 * sender's other tabs too (idempotent patch). */
export function emitMessageDeleted(
  conversationId: string,
  messageId: string,
  deletedAt: string,
  participantIds: string[],
): void {
  if (!io) return;
  for (const userId of participantIds) {
    io.to(userRoom(userId)).emit('message:deleted', { conversationId, messageId, deletedAt });
  }
}

/** Push a new (or 1h-bumped) notification to the recipient's user room (Phase 7). Reaches all
 *  their tabs; the client increments the badge + prepends to the list. `notification` is the
 *  already-serialized DTO. No-op when io is unset. */
export function emitNotification(recipientId: string, notification: unknown): void {
  if (!io) return;
  io.to(userRoom(recipientId)).emit('notification:new', { notification });
}

// ── Calls (Phase 6) — LiveKit handles all WebRTC signaling, so these are thin notifications.
// All three follow the same user-room fan-out as emitNewMessage; no offer/answer/ice events.

/** Ring the OTHER participants of a new call (NOT the initiator). Drives the IncomingCallDialog
 *  + ringtone. `initiator` is the already-serialized public user DTO. */
export function emitCallIncoming(
  participantIds: string[],
  payload: {
    callId: string;
    conversationId: string;
    type: 'AUDIO' | 'VIDEO';
    isGroup: boolean;
    initiator: unknown;
    conversationName: string | null;
  },
): void {
  if (!io) return;
  for (const userId of participantIds) {
    io.to(userRoom(userId)).emit('call:incoming', payload);
  }
}

/** Tell the initiator a recipient declined (their ringing UI closes). For a DIRECT call this is
 *  paired with call:ended (the call is also over); for GROUP it's informational (room stays open). */
export function emitCallDeclined(
  initiatorId: string,
  payload: { callId: string; conversationId: string; userId: string },
): void {
  if (!io) return;
  io.to(userRoom(initiatorId)).emit('call:declined', payload);
}

/** Broadcast that a call is over (final endedAt + reason) to every participant's user room.
 *  Clients patch the CALL message in their thread (patchCallEnded) + leave the room if in it. */
export function emitCallEnded(
  participantIds: string[],
  payload: {
    callId: string;
    conversationId: string;
    endedAt: string;
    endedReason: 'COMPLETED' | 'MISSED' | 'DECLINED' | 'FAILED';
  },
): void {
  if (!io) return;
  for (const userId of participantIds) {
    io.to(userRoom(userId)).emit('call:ended', payload);
  }
}

/** Tell a user's conversation-partners that they just came online (D2: contact-scoped). */
export function emitPresenceOnline(userId: string, partnerIds: string[]): void {
  if (!io) return;
  for (const partnerId of partnerIds) {
    io.to(userRoom(partnerId)).emit('presence:online', { userId });
  }
}

/** Tell a user's conversation-partners that they went offline, with their last-seen time. */
export function emitPresenceOffline(
  userId: string,
  lastSeenAt: string,
  partnerIds: string[],
): void {
  if (!io) return;
  for (const partnerId of partnerIds) {
    io.to(userRoom(partnerId)).emit('presence:offline', { userId, lastSeenAt });
  }
}
