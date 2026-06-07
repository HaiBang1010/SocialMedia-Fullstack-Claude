import { z } from 'zod';

// Mirrors backend users.schema.ts (name max 40, bio max 160 = Prisma VarChar(160)).
// Phase 3.2 adds the private-account toggle; avatarUrl is still edited elsewhere.
export const profileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(40, 'Name must be at most 40 characters'),
  bio: z.string().max(160, 'Bio must be at most 160 characters'),
  isPrivate: z.boolean(),
});

export type ProfileValues = z.infer<typeof profileSchema>;
