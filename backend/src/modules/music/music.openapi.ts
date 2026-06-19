import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { searchMusicQuerySchema, musicListResponseSchema } from './music.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const unavailable503 = { description: 'Music search unavailable', ...json(errorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };

export function registerMusicOpenApi(registry: OpenAPIRegistry) {
  const MusicList = registry.register('MusicList', musicListResponseSchema);

  registry.registerPath({
    method: 'get',
    path: '/music/search',
    tags: ['Music'],
    summary: 'Search tracks for a Music Story (iTunes Search proxy)',
    security: [{ bearerAuth: [] }],
    request: { query: searchMusicQuerySchema },
    responses: {
      200: { description: 'Track results', ...json(MusicList) },
      400: validationError400,
      401: unauthorized401,
      503: unavailable503,
    },
  });
}
