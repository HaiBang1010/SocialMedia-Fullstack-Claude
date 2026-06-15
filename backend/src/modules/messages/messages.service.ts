import { Prisma, MessageContentType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { publicUserSelect } from '../users/users.service';
import { getViewablePost } from '../posts/posts.service';
import { isEmojiOnly } from '../../lib/emoji';
import { emitNewMessage, emitMessageReaction } from '../../socket/io';
import type { SendMessageInput } from './messages.schema';
import type { PaginationInput } from '../posts/posts.schema';

// include dùng chung cho mọi response trả 1 message. reactions ordered oldest-first so the
// client's groupReactionsByEmoji keeps a stable first-seen emoji order (Phase 5.3a). media
// ordered by `order` asc so the carousel/grid renders in the sender's chosen sequence (5.4a).
const messageInclude = {
  sender: { select: publicUserSelect },
  reactions: { orderBy: { createdAt: 'asc' } },
  media: { orderBy: { order: 'asc' } },
  // Phase 5.4c — POST_SHARE preview: the shared post's author + its first media for the card.
  // null after the post is deleted (FK SetNull). NARROW include — never serialize the full post.
  sharedPost: {
    include: {
      author: { select: publicUserSelect },
      media: { orderBy: { order: 'asc' }, take: 1 },
    },
  },
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
    // Phase 5.3a — RAW reaction rows (D2); the client aggregates into "👍 3  ❤️ 1".
    reactions: message.reactions.map((r) => ({ userId: r.userId, emoji: r.emoji })),
    // Phase 5.4a — image/video attachments (ordered). WHITELIST: objectKey/thumbnailObjectKey
    // (S3 cleanup keys) are server-only and never serialized — mirrors serializeStory.
    media: message.media.map((m) => ({
      id: m.id,
      type: m.type,
      order: m.order,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      width: m.width,
      height: m.height,
      duration: m.duration,
    })),
    // Phase 5.4c — POST_SHARE preview card (narrow); null for non-share messages and for a
    // shared post that was since deleted (FK SetNull → "Post unavailable" on the client).
    sharedPost: message.sharedPost
      ? {
          id: message.sharedPost.id,
          caption: message.sharedPost.caption,
          author: message.sharedPost.author,
          firstMedia: message.sharedPost.media[0]
            ? {
                type: message.sharedPost.media[0].type,
                url: message.sharedPost.media[0].url,
                thumbnailUrl: message.sharedPost.media[0].thumbnailUrl,
              }
            : null,
        }
      : null,
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
 * Send a message — text, image/video media (1..10, mix allowed), or both (Phase 5.4a; 5.1 was
 * TEXT-only). WRITE: a non-participant gets 403 (the act of writing proves they know the
 * conversation exists — mirrors updatePost non-owner → 403). contentType is DERIVED here, not
 * sent by the client: no media → TEXT; all-video → VIDEO; otherwise IMAGE (the "has media"
 * marker — the client renders each item by its own media.type, so a mixed carousel works).
 * Media rows are nested-created in the same write. Then bumps the conversation's lastMessageAt
 * (drives list ordering) and marks the sender as having read their own message — sequential
 * writes, no transaction (the codebase's style).
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: SendMessageInput,
) {
  if (!(await isParticipant(conversationId, senderId))) {
    throw new AppError(403, 'Forbidden', 'You are not a participant of this conversation');
  }

  const media = input.media ?? [];
  const caption = input.content && input.content.length > 0 ? input.content : null;

  // Phase 5.4c — post-share gate (E8): you can only share a post YOU can see. getViewablePost
  // throws 404 when the post is missing or not viewable by the sender (mirrors getPostById). The
  // recipient may not be able to open it later, but the preview is acceptable (sharer consent).
  if (input.sharedPostId) {
    await getViewablePost(input.sharedPostId, senderId);
  }

  // contentType is DERIVED here, never sent by the client (Phase 5.4a pattern, extended in 5.4c):
  // shared post → POST_SHARE; emoji-only text → EMOJI (jumbomoji); else by media composition.
  const contentType: MessageContentType = input.sharedPostId
    ? MessageContentType.POST_SHARE
    : media.length === 0
      ? isEmojiOnly(caption)
        ? MessageContentType.EMOJI
        : MessageContentType.TEXT
      : media.every((m) => m.type === 'VOICE') // VOICE is single + exclusive (Phase 5.4b)
        ? MessageContentType.VOICE
        : media.every((m) => m.type === 'STICKER') // sticker is single + standalone (5.4c)
          ? MessageContentType.STICKER
          : media.every((m) => m.type === 'GIF')
            ? MessageContentType.GIF
            : media.every((m) => m.type === 'VIDEO')
              ? MessageContentType.VIDEO
              : MessageContentType.IMAGE;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      contentType,
      content: caption,
      sharedPostId: input.sharedPostId ?? null,
      ...(media.length
        ? {
            media: {
              create: media.map((m) => ({
                type: m.type,
                order: m.order,
                url: m.url,
                objectKey: m.objectKey ?? null, // null for STICKER/GIF (Giphy-hosted)
                thumbnailUrl: m.thumbnailUrl ?? null,
                thumbnailObjectKey: m.thumbnailObjectKey ?? null,
                width: m.width ?? null,
                height: m.height ?? null,
                duration: m.duration ?? null,
              })),
            },
          }
        : {}),
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
  emitNewMessage(conversationId, serialized, await getParticipantIds(conversationId));

  return serialized;
}

/**
 * Every participant id of a conversation (the socket fan-out target — INCLUDES the actor, so
 * their own other tabs get the echo too). Reused by sendTextMessage + the reaction writes.
 */
export async function getParticipantIds(conversationId: string): Promise<string[]> {
  const rows = await prisma.participant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
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

/**
 * Resolve the conversation a message belongs to + assert the caller may react. Returns the
 * conversationId. 404 if the message is gone; 403 if the caller isn't a participant (reacting
 * is a WRITE — mirrors sendTextMessage non-participant → 403, per prefer-404-over-403-private).
 */
async function assertCanReact(messageId: string, userId: string): Promise<string> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) throw new AppError(404, 'MessageNotFound', 'Message not found');
  if (!(await isParticipant(message.conversationId, userId))) {
    throw new AppError(403, 'Forbidden', 'You are not a participant of this conversation');
  }
  return message.conversationId;
}

/** Re-read a message with its full include after a reaction write. 404 if it was deleted mid-flight. */
async function getMessageWithReactions(messageId: string): Promise<MessageRow> {
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: messageInclude });
  if (!message) throw new AppError(404, 'MessageNotFound', 'Message not found');
  return message;
}

/**
 * Set (or replace) the caller's reaction on a message (Phase 5.3a, D3). Upsert on the composite
 * PK keeps it to one reaction per user — a different emoji replaces the old one. Broadcasts the
 * delta to every participant's user room (D5/D6) and returns the full updated message (D4).
 */
export async function reactToMessage(messageId: string, userId: string, emoji: string) {
  const conversationId = await assertCanReact(messageId, userId);

  await prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId, emoji },
    update: { emoji },
  });

  const serialized = serializeMessage(await getMessageWithReactions(messageId));
  emitMessageReaction(conversationId, messageId, { userId, emoji }, await getParticipantIds(conversationId));
  return serialized;
}

/**
 * Remove the caller's own reaction (Phase 5.3a). deleteMany is idempotent — un-reacting twice is
 * a no-op, never an error. Broadcasts the removal delta (emoji: null) and returns the message.
 */
export async function removeReaction(messageId: string, userId: string) {
  const conversationId = await assertCanReact(messageId, userId);

  await prisma.messageReaction.deleteMany({ where: { messageId, userId } });

  const serialized = serializeMessage(await getMessageWithReactions(messageId));
  emitMessageReaction(conversationId, messageId, { userId, emoji: null }, await getParticipantIds(conversationId));
  return serialized;
}
