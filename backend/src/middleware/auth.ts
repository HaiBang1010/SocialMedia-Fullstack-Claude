import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';

/**
 * Mở rộng kiểu Request của Express để thêm field `user`.
 * Vì TypeScript không biết req.user tồn tại, ta phải declare merge.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware bắt buộc đăng nhập.
 * - Đọc Authorization header dạng "Bearer <token>"
 * - Verify token
 * - Gán req.user = { id, username }
 * - Nếu fail → 401
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Thiếu token' });
    return;
  }

  const token = authHeader.slice(7); // bỏ "Bearer "

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}
