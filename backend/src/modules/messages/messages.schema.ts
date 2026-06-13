import { z } from 'zod';
import { MessageContentType } from '@prisma/client';

/**
 * Phase 5.3a — the 7-emoji quick-react whitelist (Q1, IG/Messenger pattern). These glyphs are
 * COPIED BYTE-FOR-BYTE from the frontend source of truth (frontend/src/lib/reactions.ts);
 * ⚠️ keep them in sync — `❤️` is U+2764 + U+FE0F (variation selector), so a hand-retyped heart
 * would silently fail the enum match. The DB column stays a plain String; this Zod enum is the
 * only gate.
 */
export const REACTION_EMOJIS_BACKEND = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥'] as const;

// Body for POST /messages/:id/reactions — set/replace the caller's reaction.
export const reactionSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS_BACKEND),
});

// sender uses the 7 fields of publicUserSelect (no email/passwordHash). Exported so the
// conversations module can reuse it for participant.user + lastMessage.sender.
export const publicUserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
});

/**
 * Body for POST /conversations/:id/messages. Phase 5.1 is TEXT-only: contentType is a
 * literal('TEXT'), so the full Postgres MessageContentType enum (EMOJI/POST_SHARE/…) is
 * declared in the DB but gated here — the same pattern StoryItemType used in 4.3a.
 * Phase 5.4 widens this to a discriminatedUnion (image/video/voice/…).
 */
export const sendMessageSchema = z.object({
  contentType: z.literal('TEXT'),
  content: z.string().min(1).max(5000),
});

// One reaction row in a message DTO (Phase 5.3a, D2: RAW rows — the client aggregates into
// "👍 3  ❤️ 1" via groupReactionsByEmoji). Ordered createdAt asc by the service include.
export const messageReactionResponseSchema = z.object({
  userId: z.string(),
  emoji: z.string(),
});

export const messageResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  contentType: z.nativeEnum(MessageContentType),
  content: z.string().nullable(),
  createdAt: z.string(), // ISO
  sender: publicUserResponseSchema,
  reactions: z.array(messageReactionResponseSchema),
});

// GET /conversations/:id/messages — newest-first, cursor-paginated.
export const messagesListResponseSchema = z.object({
  messages: z.array(messageResponseSchema),
  nextCursor: z.string().nullable(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
