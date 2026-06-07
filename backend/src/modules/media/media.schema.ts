import { z } from "zod";

// Per-type upload caps. Keep the contentType enum in sync with EXT_BY_MIME in
// lib/s3.ts. Images stay at 10 MB; a single MP4 may be up to 50 MB (no transcode
// in this phase, so the original is what gets stored).
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

const VIDEO_CONTENT_TYPES = new Set<string>(["video/mp4"]);

// Base object (no refinement) — registered with OpenAPI so the spec stays a clean
// object schema. The size cap is a cross-field rule expressed in the refined
// schema below, not representable in plain JSON Schema.
export const presignRequestBaseSchema = z.object({
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "video/mp4",
  ]),
  size: z
    .number()
    .int()
    .positive()
    .describe("Bytes. Max 10MB for images, 50MB for video/mp4."),
});

// Runtime validation schema: enforces the per-contentType size cap. The error is
// attached to `size` so it surfaces under details.size in the 400 response.
export const presignRequestSchema = presignRequestBaseSchema.superRefine(
  (data, ctx) => {
    const isVideo = VIDEO_CONTENT_TYPES.has(data.contentType);
    const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (data.size > cap) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        type: "number",
        maximum: cap,
        inclusive: true,
        path: ["size"],
        message: isVideo
          ? "File too large (max 50MB for video)"
          : "File too large (max 10MB for images)",
      });
    }
  },
);

export const presignResponseSchema = z.object({
  uploadUrl: z.string().url(), // presigned PUT URL (client uploads here)
  publicUrl: z.string().url(), // URL to serve the object after upload
  objectKey: z.string(), // key to persist in DB later
  expiresIn: z.number(), // seconds until uploadUrl expires
});

export type PresignRequest = z.infer<typeof presignRequestSchema>;
export type PresignResponse = z.infer<typeof presignResponseSchema>;
