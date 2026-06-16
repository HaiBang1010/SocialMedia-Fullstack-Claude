import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { searchQuerySchema, searchResponseSchema } from './search.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

// Registered after Posts/Messages so the SearchResults schema $refs the existing Post component.
export function registerSearchOpenApi(registry: OpenAPIRegistry) {
  const SearchResults = registry.register('SearchResults', searchResponseSchema);

  registry.registerPath({
    method: 'get',
    path: '/search',
    tags: ['Search'],
    summary: 'Full-text search over posts and users',
    description:
      'Ranked by relevance (ts_rank). Posts respect visibility (PUBLIC, own, or FOLLOWERS-where-' +
      'following); users are returned regardless of privacy (isPrivate is a flag). ' +
      'Optional auth — anonymous searchers see only PUBLIC posts.',
    security: [{ bearerAuth: [] }, {}],
    request: { query: searchQuerySchema },
    responses: {
      200: { description: 'Search results', ...json(SearchResults) },
      400: { description: 'Validation error', ...json(validationErrorResponseSchema) },
      401: { description: 'Unauthorized', ...json(errorResponseSchema) },
    },
  });
}
