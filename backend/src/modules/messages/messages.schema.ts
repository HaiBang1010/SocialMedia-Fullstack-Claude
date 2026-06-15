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
  // objectKey is the S3 cleanup key for UPLOADED media (image/video/voice). Optional because
  // STICKER/GIF are Giphy-hosted third-party URLs with no S3 object (Phase 5.4c). Required per-type
  // in sendMessageSchema's superRefine below.
  objectKey: z.string().min(1).optional(),
  // thumbnail required for IMAGE/VIDEO, absent for VOICE/STICKER/GIF — enforced per-type below.
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
    // Phase 5.4c — share a post into the conversation. Exclusive with media; a caption is allowed
    // (E2). The server validates viewability + derives contentType POST_SHARE.
    sharedPostId: z.string().cuid().optional(),
  })
  .superRefine((data, ctx) => {
    const media = data.media ?? [];
    const hasContent = !!data.content && data.content.length > 0;

    if (!hasContent && media.length === 0 && !data.sharedPostId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A message must have text content, media, or a shared post',
      });
    }
    // A shared post is its own message — never combined with media (a caption is allowed).
    if (data.sharedPostId && media.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sharedPostId'],
        message: 'A shared post cannot be combined with media',
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
    // STICKER/GIF is a standalone message: exactly one item, no caption, no other media (E1).
    if (media.some((m) => m.type === 'STICKER' || m.type === 'GIF') && (media.length > 1 || hasContent)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['media'],
        message: 'A sticker or GIF must be sent on its own (no caption or other media)',
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
      // objectKey backs S3 recall-cleanup for uploaded media; STICKER/GIF are Giphy-hosted (no key).
      if ((m.type === 'IMAGE' || m.type === 'VIDEO' || m.type === 'VOICE') && !m.objectKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['media', i, 'objectKey'],
          message: 'objectKey is required for uploaded media',
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

// Phase 5.4c — a shared-post preview embedded in a POST_SHARE message. NARROW: just enough to
// render the card (author + caption + first media thumbnail). Click-through fetches the full post
// and re-checks visibility. null when the post was deleted (FK SetNull).
export const sharedPostResponseSchema = z.object({
  id: z.string(),
  caption: z.string().nullable(),
  author: publicUserResponseSchema,
  firstMedia: z
    .object({
      type: z.nativeEnum(MediaType),
      url: z.string(),
      thumbnailUrl: z.string().nullable(),
    })
    .nullable(),
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
  // Phase 5.4c — present (object or null) only meaningful for POST_SHARE; null otherwise.
  sharedPost: sharedPostResponseSchema.nullable(),
});

// GET /conversations/:id/messages — newest-first, cursor-paginated.
export const messagesListResponseSchema = z.object({
  messages: z.array(messageResponseSchema),
  nextCursor: z.string().nullable(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageMediaInput = z.infer<typeof messageMediaInputSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
