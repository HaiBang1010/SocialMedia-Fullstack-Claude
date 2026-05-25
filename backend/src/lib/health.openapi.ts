import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const healthResponseSchema = z
  .object({
    status: z.string(),
    timestamp: z.string().datetime(),
  })
  .openapi({ example: { status: 'ok', timestamp: '2026-01-01T00:00:00.000Z' } });

export function registerHealthOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['Meta'],
    summary: 'Health check',
    responses: {
      200: {
        description: 'Server is running',
        content: { 'application/json': { schema: healthResponseSchema } },
      },
    },
  });
}
