import { z } from 'zod';
import { NotificationType } from '@prisma/client';
import { publicUserResponseSchema } from '../messages/messages.schema';

// ── Response shapes (for OpenAPI doc) ──
export const notificationResponseSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(NotificationType),
  actor: publicUserResponseSchema,
  postId: z.string().nullable(), // deep-link target (LIKE/COMMENT), null for FOLLOW
  commentId: z.string().nullable(), // deep-link target (COMMENT), null otherwise
  isRead: z.boolean(),
  createdAt: z.string(), // ISO
});

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationResponseSchema),
  nextCursor: z.string().nullable(),
});

export const unreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});
