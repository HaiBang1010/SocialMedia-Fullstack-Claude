import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Tạo middleware validate request bằng Zod schema.
 * Nếu sai → trả 400 với chi tiết lỗi.
 * Nếu đúng → ghi đè req[source] bằng data đã parse (đã coerce types).
 *
 * Dùng:
 *   router.post('/login', validate(loginSchema, 'body'), asyncHandler(...))
 */
export function validate(schema: ZodSchema, source: Source = 'body'): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      // Replace với data đã được Zod parse/transform
      (req as any)[source] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Dữ liệu không hợp lệ',
          details: err.flatten().fieldErrors,
        });
        return;
      }
      next(err);
    }
  };
}
