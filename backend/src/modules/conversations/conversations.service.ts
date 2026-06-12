import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { publicUserSelect } from '../users/users.service';
import { serializeMessage } from '../messages/messages.service';
import type { CreateGroupInput } from './conversations.schema';
import type { PaginationInput } from '../posts/posts.schema';

// include shared by every endpoint returning a conversation: participants (each with their
// public user) + the newest non-deleted message as the list preview (lastMessage).
const conversationInclude = {
  participants: { include: { user: { select: publicUserSelect } } },
  messages: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { sender: { select: publicUserSelect } },
  },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

/**
 * Transform a Prisma conversation into the API DTO. WHITELIST — directKey (a server-only
 * dedup key) is never exposed. lastMessage = the newest non-deleted message, or null.
 */
function serializeConversation(convo: ConversationRow) {
  return {
    id: convo.id,
    type: convo.type,
    name: convo.name,
    avatarUrl: convo.avatarUrl,
    createdAt: convo.createdAt.toISOString(),
    lastMessageAt: convo.lastMessageAt.toISOString(),
    participants: convo.participants.map((p) => ({ user: p.user, isAdmin: p.isAdmin })),
    lastMessage: convo.messages[0] ? serializeMessage(convo.messages[0]) : null,
  };
}

/** Deterministic, order-independent unique key for the DIRECT conversation of two users. */
function directKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}

/**
 * Find (or create) the 1-1 conversation between two users. Race-safe + idempotent via the
 * directKey UNIQUE constraint + upsert — the same "upsert on a unique key" idiom the repo
 * uses for Follow/Like/StoryView, so two fast clicks can never create duplicates and no
 * transaction is needed.
 */
export async function findOrCreateDirectConversation(meId: string, targetUserId: string) {
  if (targetUserId === meId) {
    throw new AppError(400, 'CannotMessageSelf', 'You cannot start a conversation with yourself');
  }
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  const directKey = directKeyFor(meId, targetUserId);
  const convo = await prisma.conversation.upsert({
    where: { directKey },
    create: {
      type: 'DIRECT',
      directKey,
      participants: { create: [{ userId: meId }, { userId: targetUserId }] },
    },
    update: {}, // already exists → no-op, return it
    include: conversationInclude,
  });
  return serializeConversation(convo);
}

/**
 * Create a GROUP conversation. participantIds are the OTHER members; the creator is added
 * as admin. Dedupes ids, drops the creator if present, and requires ≥1 other valid member.
 */
export async function createGroupConversation(creatorId: string, input: CreateGroupInput) {
  const otherIds = [...new Set(input.participantIds)].filter((id) => id !== creatorId);
  if (otherIds.length === 0) {
    throw new AppError(400, 'InvalidParticipants', 'A group needs at least one other participant');
  }

  const found = await prisma.user.findMany({
    where: { id: { in: otherIds } },
    select: { id: true },
  });
  if (found.length !== otherIds.length) {
    throw new AppError(400, 'InvalidParticipants', 'One or more participants do not exist');
  }

  const convo = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: input.name,
      participants: {
        create: [
          { userId: creatorId, isAdmin: true },
          ...otherIds.map((id) => ({ userId: id, isAdmin: false })),
        ],
      },
    },
    include: conversationInclude,
  });
  return serializeConversation(convo);
}

/**
 * The viewer's conversations, most-recent activity first (lastMessageAt desc, id desc).
 * Cursor on id. Non-members simply never match the `some` filter.
 */
export async function listConversations(userId: string, pagination: PaginationInput) {
  const { cursor, limit } = pagination;

  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: conversationInclude,
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  return { conversations: slice.map(serializeConversation), nextCursor };
}

/**
 * One conversation by id. READ: a non-participant (or a missing id) gets 404 — existence
 * hidden (mirrors getViewablePost PRIVATE → 404, per prefer-404-over-403-private).
 */
export async function getConversation(conversationId: string, userId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });
  if (!convo || !convo.participants.some((p) => p.userId === userId)) {
    throw new AppError(404, 'ConversationNotFound', 'Conversation not found');
  }
  return serializeConversation(convo);
}
