import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { presignRequestSchema } from "./media.schema";
import * as mediaService from "./media.service";

const router = Router();

/**
 * POST /media/presign
 * Header: Authorization: Bearer <accessToken>
 * Body: { contentType, size }
 * Returns a presigned PUT URL for direct-to-storage upload.
 */
router.post(
  "/presign",
  requireAuth,
  validate(presignRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await mediaService.generatePresignedUploadUrl(
      req.user!.id,
      req.body.contentType,
      req.body.size,
    );
    res.json(result);
  }),
);

export default router;
