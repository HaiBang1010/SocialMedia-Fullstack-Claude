import { z } from 'zod';
import { MessageContentType, MediaType } from '@prisma/client';

// Phase 5.4a — max attachments per message (D-Q1). Exported so the FE can mirror the cap.
export const MAX_MESSAGE_MEDIA = 10;

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
 * One image/video attachment in a send-message body (Phase 5.4a). The client uploads the
 * original + a thumbnail/poster to MinIO via presign FIRST, then sends these references.
 * objectKey / thumbnailObjectKey are persisted so the S3 objects can be cleaned up on recall
 * (Phase 5.5). thumbnailUrl is required for BOTH types (image thumb / video poster, Q6).
 * The VIDEO-requires-duration check lives in sendMessageSchema's superRefine (keeps this a
 * plain object, which zod-to-openapi renders cleanly).
 */
const messageMediaInputSchema = z.object({
  type: z.nativeEnum(MediaType),
  order: z.number().int().min(0),
  url: z.string().url(),
  objectKey: z.string().min(1),
  // thumbnail required for IMAGE/VIDEO, absent for VOICE (audio has no thumbnail) — enforced
  // per-type in sendMessageSchema's superRefine below.
  thumbnailUrl: z.string().url().optional(),
  thumbnailObjectKey: z.string().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(),
});

/**
 * Body for POST /conversations/:id/messages (Phase 5.4a widens the 5.1 TEXT-only literal).
 * A message carries an optional text caption AND/OR 1..10 media items (images + videos may be
 * mixed — D2). The server derives contentType (no media → TEXT; all-video → VIDEO; else IMAGE
 * marker). superRefine enforces: at least one of content/media, and duration for each VIDEO.
 */
export const sendMessageSchema = z
  .object({
    content: z.string().trim().max(5000).optional(),
    media: z.array(messageMediaInputSchema).max(MAX_MESSAGE_MEDIA).optional(),
  })
  .superRefine((data, ctx) => {
    const media = data.media ?? [];
    if (!data.content && media.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A message must have text content or at least one media item',
      });
    }
    // VOICE is exclusive: a single voice clip, never combined with image/video or another voice.
    if (media.some((m) => m.type === 'VOICE') && media.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['media'],
        message: 'A voice message cannot be combined with other media',
      });
    }
    media.forEach((m, i) => {
      if ((m.type === 'VIDEO' || m.type === 'VOICE') && m.duration == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['media', i, 'duration'],
          message: 'duration is required for VIDEO/VOICE media',
        });
      }
      if ((m.type === 'IMAGE' || m.type === 'VIDEO') && (!m.thumbnailUrl || !m.thumbnailObjectKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['media', i, 'thumbnailUrl'],
          message: 'thumbnailUrl and thumbnailObjectKey are required for image/video media',
        });
      }
    });
  });

// One reaction row in a message DTO (Phase 5.3a, D2: RAW rows — the client aggregates into
// "👍 3  ❤️ 1" via groupReactionsByEmoji). Ordered createdAt asc by the service include.
export const messageReactionResponseSchema = z.object({
  userId: z.string(),
  emoji: z.string(),
});

// One media item in a message DTO (Phase 5.4a). WHITELIST — objectKey/thumbnailObjectKey are
// server-only (cleanup keys) and never exposed. Ordered by `order` asc via the service include.
export const messageMediaResponseSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(MediaType),
  order: z.number().int(),
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  duration: z.number().int().nullable(),
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
  media: z.array(messageMediaResponseSchema),
});

// GET /conversations/:id/messages — newest-first, cursor-paginated.
export const messagesListResponseSchema = z.object({
  messages: z.array(messageResponseSchema),
  nextCursor: z.string().nullable(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageMediaInput = z.infer<typeof messageMediaInputSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
