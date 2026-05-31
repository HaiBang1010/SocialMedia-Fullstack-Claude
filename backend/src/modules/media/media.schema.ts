import { z } from "zod";

// 10 MB. Keep contentType enum in sync with EXT_BY_MIME in lib/s3.ts.
export const presignRequestSchema = z.object({
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ]),
  size: z
    .number()
    .int()
    .positive()
    .max(10485760, "File too large (max 10MB)"),
});

export const presignResponseSchema = z.object({
  uploadUrl: z.string().url(), // presigned PUT URL (client uploads here)
  publicUrl: z.string().url(), // URL to serve the object after upload
  objectKey: z.string(), // key to persist in DB later
  expiresIn: z.number(), // seconds until uploadUrl expires
});

export type PresignRequest = z.infer<typeof presignRequestSchema>;
export type PresignResponse = z.infer<typeof presignResponseSchema>;
