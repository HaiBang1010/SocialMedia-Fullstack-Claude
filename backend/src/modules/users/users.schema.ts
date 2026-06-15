import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  isPrivate: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Query for GET /users/groupable (Phase 5.5) — optional partial-match `q` + a result cap. The
 * list is search-driven and small (recent partners + mutuals), so there's no cursor pagination.
 */
export const groupableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GroupableQueryInput = z.infer<typeof groupableQuerySchema>;

/**
 * One entry of GET /users/groupable — the 7 public fields plus a `source` flag telling the UI
 * whether the suggestion came from a recent conversation or a mutual-follow relationship.
 */
export const groupableUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(), // ISO
  source: z.enum(['recent', 'mutual']),
});

/**
 * Response shape of GET /users/:username — the 7 public fields + social counts +
 * the viewer's follow relationship (null for anonymous or self). Distinct from
 * the self `User` schema (which carries `email`); this is the public profile DTO.
 */
export const userProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(), // ISO
  postsCount: z.number(),
  followersCount: z.number(),
  followingCount: z.number(),
  isFollowing: z.boolean().nullable(),
  hasActiveStory: z.boolean(), // Phase 4.4 — drives the story ring on the profile avatar
});

export type UserProfile = z.infer<typeof userProfileSchema>;
