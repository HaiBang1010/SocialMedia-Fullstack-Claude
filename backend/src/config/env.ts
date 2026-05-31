import "dotenv/config";
import { z } from "zod";

/**
 * Validate env vars khi server start.
 * Nếu thiếu hoặc sai format → app crash ngay (tốt: phát hiện lỗi sớm).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET phải ít nhất 32 ký tự"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET phải ít nhất 32 ký tự"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("1h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // ── Storage (MinIO / S3) ──
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(8),
  S3_BUCKET: z.string().min(1),
  S3_PUBLIC_URL: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
