import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Custom error class để throw từ services.
 * Cho phép set status code rõ ràng.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Error handler tập trung — phải đặt CUỐI CÙNG trong chuỗi middleware.
 * Express nhận biết error handler vì có 4 tham số (err, req, res, next).
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // AppError do mình throw
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message });
    return;
  }

  // Lỗi unique constraint của Prisma (vd: email/username đã tồn tại)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[]) || [];
      res.status(409).json({
        error: 'Conflict',
        message: `${fields.join(', ')} already exists`,
      });
      return;
    }
  }

  // Lỗi không xác định → log + trả 500
  console.error('[Unhandled error]', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Something went wrong on the server',
  });
};

/**
 * 404 handler — cho route không match.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.url} not found`,
  });
}
