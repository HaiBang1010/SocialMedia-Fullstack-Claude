import { S3Client } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import { env } from "../config/env";

/**
 * S3-compatible client singleton (MinIO in dev).
 * forcePathStyle is REQUIRED for MinIO — it serves buckets as path segments
 * (http://host/bucket/key) instead of AWS virtual-hosted style (http://bucket.host/key).
 */
export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

// MIME → file extension. Keep in sync with presignRequestSchema enum.
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
};

/** Public URL to serve an object after upload (bucket is public-read in dev). */
export function getPublicUrl(key: string): string {
  return `${env.S3_PUBLIC_URL}/${key}`;
}

/**
 * Build a collision-resistant object key namespaced per user.
 * Format: media/user_<userId>/<unixSeconds>_<random8hex>.<ext>
 */
export function generateObjectKey(userId: string, contentType: string): string {
  const ext = EXT_BY_MIME[contentType] ?? "bin";
  const ts = Math.floor(Date.now() / 1000); // unix seconds
  const rand = randomBytes(4).toString("hex"); // 8 hex chars
  return `media/user_${userId}/${ts}_${rand}.${ext}`;
}
