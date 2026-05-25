import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  isPrivate: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
