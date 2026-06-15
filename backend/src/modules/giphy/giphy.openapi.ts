import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { giphySearchSchema, giphyTrendingSchema, giphyListResponseSchema } from './giphy.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const unavailable503 = { description: 'Giphy unavailable', ...json(errorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };

export function registerGiphyOpenApi(registry: OpenAPIRegistry) {
  const GiphyList = registry.register('GiphyList', giphyListResponseSchema);

  registry.registerPath({
    method: 'get',
    path: '/giphy/search',
    tags: ['Giphy'],
    summary: 'Search Giphy GIFs or stickers (server-side key proxy)',
    security: [{ bearerAuth: [] }],
    request: { query: giphySearchSchema },
    responses: {
      200: { description: 'Giphy results', ...json(GiphyList) },
      400: validationError400,
      401: unauthorized401,
      503: unavailable503,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/giphy/trending',
    tags: ['Giphy'],
    summary: 'Trending Giphy GIFs or stickers',
    security: [{ bearerAuth: [] }],
    request: { query: giphyTrendingSchema },
    responses: {
      200: { description: 'Giphy results', ...json(GiphyList) },
      400: validationError400,
      401: unauthorized401,
      503: unavailable503,
    },
  });
}
