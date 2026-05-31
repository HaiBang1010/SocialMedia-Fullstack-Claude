import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, generateObjectKey, getPublicUrl } from "../../lib/s3";
import { env } from "../../config/env";
import type { PresignResponse } from "./media.schema";

const EXPIRES_IN = 900; // 15 minutes

/**
 * Issue a presigned PUT URL so the client can upload directly to storage.
 * ContentLength is baked into the signature → the URL is only valid for a file
 * of EXACTLY this size; a mismatched upload is rejected by MinIO. This is the
 * second size-enforcement layer after Zod validation at the API boundary.
 */
export async function generatePresignedUploadUrl(
  userId: string,
  contentType: string,
  size: number,
): Promise<PresignResponse> {
  const objectKey = generateObjectKey(userId, contentType);

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: size,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: EXPIRES_IN,
  });

  return {
    uploadUrl,
    publicUrl: getPublicUrl(objectKey),
    objectKey,
    expiresIn: EXPIRES_IN,
  };
}
