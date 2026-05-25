import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { updateProfileSchema } from './users.schema';
import * as usersService from './users.service';

const router = Router();

/**
 * PATCH /users/me
 * Header: Authorization: Bearer <accessToken>
 * Body: { name?, bio?, avatarUrl?, isPrivate? }
 */
router.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateProfile(req.user!.id, req.body);
    res.json({ user });
  })
);

/**
 * GET /users/:username
 * Public — xem profile của bất kỳ user nào.
 */
router.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const user = await usersService.getUserByUsername(req.params.username);
    res.json({ user });
  })
);

export default router;
