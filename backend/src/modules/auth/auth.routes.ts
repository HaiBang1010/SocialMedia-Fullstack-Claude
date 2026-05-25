import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema';
import * as authService from './auth.service';

const router = Router();

/**
 * POST /auth/register
 * Body: { username, email, password, name }
 * Returns: { user, accessToken, refreshToken }
 */
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  })
);

/**
 * POST /auth/login
 * Body: { identifier, password }   // identifier = email hoặc username
 * Returns: { user, accessToken, refreshToken }
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  })
);

/**
 * POST /auth/refresh
 * Body: { refreshToken }
 * Returns: { accessToken }
 */
router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.json(result);
  })
);

/**
 * GET /auth/me
 * Header: Authorization: Bearer <accessToken>
 * Returns: { user }
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    // requireAuth đã set req.user
    const user = await authService.getCurrentUser(req.user!.id);
    res.json({ user });
  })
);

/**
 * POST /auth/logout
 * Stateless JWT → logout chỉ là client xóa token.
 * Endpoint này tồn tại để frontend có chỗ gọi (sau này có thể blacklist token).
 */
router.post('/logout', (req, res) => {
  res.json({ message: 'Đã đăng xuất' });
});

export default router;
