import { z } from 'zod';
import { postResponseSchema } from '../posts/posts.schema';
import { publicUserResponseSchema } from '../messages/messages.schema';

/**
 * Phase 7 — full-text search query. `q` is required + bounded; rank-ordered results use
 * limit + offset (ts_rank isn't a stable cursor key). `type` scopes which arrays are populated.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(['posts', 'users', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(20).default(20),
  offset: z.coerce.number().int().min(0).max(200).default(0),
});

export const searchResponseSchema = z.object({
  posts: z.array(postResponseSchema),
  users: z.array(publicUserResponseSchema),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
