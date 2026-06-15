import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { reactionSchema } from './messages.schema';
import * as messagesService from './messages.service';

// Phase 5.3a — standalone /messages routes (mounted at /messages in server.ts). The
// per-conversation message endpoints (GET/POST /conversations/:id/messages) stay in
// conversations.routes; these message-scoped actions live here, mirroring how /comments/:id
// has its own comments.routes alongside /posts/:id/comments.
const router = Router();

/**
 * POST /messages/:id/reactions — set or replace the caller's reaction (participant only; 403
 * otherwise, 404 if the message doesn't exist). Returns the full updated message.
 */
router.post(
  '/:id/reactions',
  requireAuth,
  validate(reactionSchema),
  asyncHandler(async (req, res) => {
    const message = await messagesService.reactToMessage(req.params.id, req.user!.id, req.body.emoji);
    res.json(message);
  }),
);

/**
 * DELETE /messages/:id/reactions — remove the caller's own reaction (idempotent). Returns the
 * full updated message.
 */
router.delete(
  '/:id/reactions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const message = await messagesService.removeReaction(req.params.id, req.user!.id);
    res.json(message);
  }),
);

/**
 * DELETE /messages/:id — recall (soft-delete) your own message within 15 minutes (Phase 5.5).
 * Sender only (403 else), 404 if missing, 410 once the window elapses. Returns the tombstone
 * message. The more specific /:id/reactions routes are declared above, so this never shadows them.
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const message = await messagesService.recallMessage(req.params.id, req.user!.id);
    res.json(message);
  }),
);

export default router;
