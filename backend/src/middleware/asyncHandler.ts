import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Express không tự bắt lỗi từ async functions.
 * Wrapper này bắt lỗi từ Promise rejection và forward sang error middleware.
 *
 * Dùng:
 *   router.get('/me', asyncHandler(async (req, res) => {
 *     const user = await prisma.user.findUnique(...)
 *     res.json(user)
 *   }))
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
