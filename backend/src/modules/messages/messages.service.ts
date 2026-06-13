import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { publicUserSelect } from '../users/users.service';
import { emitNewMessage } from '../../socket/io';
import type { SendMessageInput } from './messages.schema';
import type { PaginationInput } from '../posts/posts.schema';

// include dùng chung cho mọi response trả 1 message.
const messageInclude = {
  sender: { select: publicUserSelect },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

/**
 * Transform a Prisma message into the API DTO. sender keeps its Date — res.json()
 * serializes to ISO at the HTTP layer (project convention). Exported so the conversations
 * module can serialize the last-message preview from the same shape.
 */
export function serializeMessage(message: MessageRow) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    contentType: message.contentType,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender,
  };
}

/** Membership lookup on the composite PK. True if userId is a participant. Exported so the
 * socket layer (rooms / typing / read receipts) reuses the same check (Phase 5.2). */
export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const member = await prisma.participant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { userId: true },
  });
  return member !== null;
}

/**
 * List a conversation's messages, newest-first (cursor on id). READ: a non-participant
 * gets 404 (existence hidden — mirrors getViewablePost / prefer-404-over-403). Soft-deleted
 * messages (Phase 5.5 recall) are excluded.
 */
export async function listMessages(
  conversationId: string,
  userId: string,
  pagination: PaginationInput,
) {
  if (!(await isParticipant(conversationId, userId))) {
    throw new AppError(404, 'ConversationNotFound', 'Conversation not found');
  }

  const { cursor, limit } = pagination;

  const rows = await prisma.message.findMany({
    where: { conversationId, deletedAt: null },
    include: messageInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  return { messages: slice.map(serializeMessage), nextCursor };
}

/**
 * Send a TEXT message. WRITE: a non-participant gets 403 (the act of writing proves they
 * know the conversation exists — mirrors updatePost non-owner → 403). Bumps the
 * conversation's lastMessageAt (drives list ordering) and marks the sender as having read
 * their own message. Three sequential writes — no transaction (the codebase's style).
 */
export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  input: SendMessageInput,
) {
  if (!(await isParticipant(conversationId, senderId))) {
    throw new AppError(403, 'Forbidden', 'You are not a participant of this conversation');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      contentType: 'TEXT',
      content: input.content,
    },
    include: messageInclude,
  });

  // Denormalize newest-message time for conversation-list ordering, and auto-read the
  // sender's own message (so it never counts toward their unread badge in Phase 5.3).
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt },
  });
  await prisma.participant.update({
    where: { conversationId_userId: { conversationId, userId: senderId } },
    data: { lastReadMessageId: message.id },
  });

  // Phase 5.2 — broadcast the persisted message to every participant's user room (send stays
  // REST; the socket only fans the result out). Reaches the sender's other tabs too — clients
  // dedup by message.id. No-op if the socket server isn't up.
  const serialized = serializeMessage(message);
  const participants = await prisma.participant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  emitNewMessage(
    conversationId,
    serialized,
    participants.map((p) => p.userId),
  );

  return serialized;
}

/**
 * Mark a conversation as read up to its newest message for `userId` (Phase 5.2 read receipts,
 * mark-on-open). Sets Participant.lastReadMessageId. Returns the read message id, or null when
 * there are no messages OR it was already the last-read (so the caller skips the broadcast).
 */
export async function markConversationRead(conversationId: string, userId: string) {
  const newest = await prisma.message.findFirst({
    where: { conversationId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  if (!newest) return null;

  const participant = await prisma.participant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { lastReadMessageId: true },
  });
  if (!participant) return null; // not a member (defensive; caller verifies first)
  if (participant.lastReadMessageId === newest.id) return null; // already read → nothing to do

  await prisma.participant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadMessageId: newest.id },
  });
  return { messageId: newest.id };
}

/**
 * Distinct user ids of everyone `userId` shares a conversation with — the presence fan-out
 * target (Phase 5.2, D2 contact-scoped). Excludes the user themselves.
 */
export async function getConversationPartners(userId: string): Promise<string[]> {
  const rows = await prisma.participant.findMany({
    where: {
      userId: { not: userId },
      conversation: { participants: { some: { userId } } },
    },
    distinct: ['userId'],
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
