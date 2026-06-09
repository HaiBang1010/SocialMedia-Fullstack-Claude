import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  isPrivate: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

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
