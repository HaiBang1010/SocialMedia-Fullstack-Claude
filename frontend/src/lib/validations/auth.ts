import { z } from 'zod';

// Login — backend loginSchema only requires min(1); we tighten password
// slightly for UX. Field name is "identifier" (email OR username).
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Register — mirrors backend auth.schema.ts exactly to avoid a 400 round-trip.
export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(40, 'Name must be at most 40 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username must be at most 24 characters')
    .regex(
      /^[a-z0-9._]+$/,
      'Username may only contain lowercase letters, numbers, dots and underscores'
    ),
  email: z.email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
