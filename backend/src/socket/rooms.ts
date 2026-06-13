import type { Socket } from 'socket.io';
import { isParticipant } from '../modules/messages/messages.service';
import { userRoom, convoRoom } from './io';

/**
 * Phase 5.2 — room membership helpers.
 * - user room: joined on connect, the target for message:new + presence (works whether or not
 *   the thread is open).
 * - conversation room: joined when the thread opens, the target for typing + read receipts
 *   (only people actively viewing).
 */

export function joinUserRoom(socket: Socket, userId: string): void {
  socket.join(userRoom(userId));
}

/**
 * Join a conversation room AFTER verifying membership (reuses messages.service.isParticipant).
 * Returns false without joining for a non-participant — they simply receive no typing/read
 * events for a conversation they aren't in.
 */
export async function joinConversation(
  socket: Socket,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  if (!(await isParticipant(conversationId, userId))) return false;
  socket.join(convoRoom(conversationId));
  return true;
}

export function leaveConversation(socket: Socket, conversationId: string): void {
  socket.leave(convoRoom(conversationId));
}
