import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Singleton pattern: chỉ tạo 1 PrismaClient cho toàn app.
 * Trong dev (hot reload) cần lưu vào globalThis để tránh memory leak.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
