import { z } from 'zod';
import { ConversationType } from '@prisma/client';
import { messageResponseSchema, publicUserResponseSchema } from '../messages/messages.schema';

/** Start (or reuse) a 1-1 conversation with another user. */
export const createDirectSchema = z.object({
  targetUserId: z.string().min(1),
});

/**
 * Create a group conversation. participantIds are the OTHER members (the creator is added
 * automatically as admin). The service dedupes + drops the creator if present.
 */
export const createGroupSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  name: z.string().min(1).max(100),
});

// ── Response shapes (cho OpenAPI doc) ──
export const participantResponseSchema = z.object({
  user: publicUserResponseSchema,
  isAdmin: z.boolean(),
});

export const conversationResponseSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ConversationType),
  name: z.string().nullable(), // GROUP only
  avatarUrl: z.string().nullable(), // GROUP only
  createdAt: z.string(), // ISO
  lastMessageAt: z.string(), // ISO
  participants: z.array(participantResponseSchema),
  lastMessage: messageResponseSchema.nullable(),
});

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationResponseSchema),
  nextCursor: z.string().nullable(),
});

export type CreateDirectInput = z.infer<typeof createDirectSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
