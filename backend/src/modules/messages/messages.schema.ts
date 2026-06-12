import { z } from 'zod';
import { MessageContentType } from '@prisma/client';

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

export const messageResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  contentType: z.nativeEnum(MessageContentType),
  content: z.string().nullable(),
  createdAt: z.string(), // ISO
  sender: publicUserResponseSchema,
});

// GET /conversations/:id/messages — newest-first, cursor-paginated.
export const messagesListResponseSchema = z.object({
  messages: z.array(messageResponseSchema),
  nextCursor: z.string().nullable(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
