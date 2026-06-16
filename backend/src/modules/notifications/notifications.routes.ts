import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { paginationSchema } from '../posts/posts.schema';
import * as notificationsService from './notifications.service';

const router = Router();

/**
 * GET /notifications — the viewer's notifications, newest-first (cursor pagination).
 */
router.get(
  '/',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await notificationsService.listNotifications(req.user!.id, req.query as any);
    res.json(result);
  }),
);

/**
 * GET /notifications/unread-count — count of unread notifications (nav badge). Literal route
 * declared before /:id/read so it is never captured as an id.
 */
router.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await notificationsService.getUnreadCount(req.user!.id);
    res.json(result);
  }),
);

/**
 * PATCH /notifications/read-all — mark every unread notification read.
 */
router.patch(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await notificationsService.markAllRead(req.user!.id);
    res.json(result);
  }),
);

/**
 * PATCH /notifications/:id/read — mark one notification read (idempotent; non-owner = no-op).
 * Declared after the literal /unread-count + /read-all routes.
 */
router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await notificationsService.markRead(req.user!.id, req.params.id);
    res.json(result);
  }),
);

export default router;
