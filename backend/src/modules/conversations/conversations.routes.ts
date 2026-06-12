import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { createDirectSchema, createGroupSchema } from './conversations.schema';
import { sendMessageSchema } from '../messages/messages.schema';
import { paginationSchema } from '../posts/posts.schema';
import * as conversationsService from './conversations.service';
import * as messagesService from '../messages/messages.service';

const router = Router();

/**
 * POST /conversations/direct — start or reuse a 1-1 conversation. Idempotent (directKey).
 * Declared before /:id so the literal isn't captured as an id.
 */
router.post(
  '/direct',
  requireAuth,
  validate(createDirectSchema),
  asyncHandler(async (req, res) => {
    const convo = await conversationsService.findOrCreateDirectConversation(
      req.user!.id,
      req.body.targetUserId,
    );
    res.status(201).json(convo);
  }),
);

/**
 * POST /conversations/group — create a group conversation (creator becomes admin).
 */
router.post(
  '/group',
  requireAuth,
  validate(createGroupSchema),
  asyncHandler(async (req, res) => {
    const convo = await conversationsService.createGroupConversation(req.user!.id, req.body);
    res.status(201).json(convo);
  }),
);

/**
 * GET /conversations — the viewer's conversations, recent activity first (cursor).
 */
router.get(
  '/',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await conversationsService.listConversations(req.user!.id, req.query as any);
    res.json(result);
  }),
);

/**
 * GET /conversations/:id/messages — messages newest-first (participant only; 404 else).
 * Delegates to the messages module (the /conversations/:id/messages split mirrors how
 * GET/POST /posts/:id/comments live in posts.routes).
 */
router.get(
  '/:id/messages',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await messagesService.listMessages(req.params.id, req.user!.id, req.query as any);
    res.json(result);
  }),
);

/**
 * POST /conversations/:id/messages — send a TEXT message (participant only; 403 else).
 */
router.post(
  '/:id/messages',
  requireAuth,
  validate(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const message = await messagesService.sendTextMessage(req.params.id, req.user!.id, req.body);
    res.status(201).json(message);
  }),
);

/**
 * GET /conversations/:id — one conversation (participant only; 404 else).
 * Declared after the more specific /:id/messages paths.
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const convo = await conversationsService.getConversation(req.params.id, req.user!.id);
    res.json(convo);
  }),
);

export default router;
