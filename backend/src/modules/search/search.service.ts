import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { postInclude, serializePost } from '../posts/posts.service';
import type { SearchQuery } from './search.schema';

// Raw row shapes — $queryRaw results are NOT covered by the generated client, so type them by
// hand. searchVector is Unsupported (excluded from the client); we read it only via these queries.
type UserSearchRow = {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: Date;
};

/**
 * Build a safe PREFIX tsquery from arbitrary user input for search-as-you-type. Extracts
 * alphanumeric word tokens (Unicode letters/digits), appends :* to each (so "swag" prefix-matches
 * the lexeme "swagtest429"), and joins with &. Returns '' when there is no usable token.
 *
 * We build the tsquery in JS and hand it to to_tsquery (still a bound parameter) instead of using
 * websearch_to_tsquery directly: websearch only matches WHOLE lexemes (typing a partial handle
 * finds nothing), which breaks the debounced search box. Because the output only ever contains
 * `token:* & token:*`, to_tsquery can't hit a parse/operator-injection error here (the usual
 * reason to avoid raw to_tsquery).
 */
function buildPrefixTsQuery(q: string): string {
  const tokens = q.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!tokens || tokens.length === 0) return '';
  return tokens.map((t) => `${t}:*`).join(' & ');
}

/**
 * Full-text user search (prefix-matched). No privacy filter (Decision E) — isPrivate is returned
 * as a flag. The explicit column list IS the whitelist (raw SQL bypasses publicUserSelect; never
 * leak email/passwordHash).
 */
async function searchUsers(tsq: string, limit: number, offset: number) {
  const rows = await prisma.$queryRaw<UserSearchRow[]>(Prisma.sql`
    SELECT id, username, name, bio, "avatarUrl", "isPrivate", "createdAt"
    FROM "User"
    WHERE "searchVector" @@ to_tsquery('english', ${tsq})
    ORDER BY ts_rank("searchVector", to_tsquery('english', ${tsq})) DESC, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `);
  // createdAt comes back as a Date; res.json serializes it to ISO (matches publicUser DTO).
  return rows;
}

/**
 * Full-text post search with the same visibility gate as getViewablePost, expressed in SQL:
 * PUBLIC for anyone, owner's own (any visibility), or FOLLOWERS where the viewer follows the
 * author. PRIVATE of others matches none of the branches → never surfaces. Anonymous viewers
 * pass an empty-string sentinel that matches no id → only PUBLIC. The ranked ids are then
 * re-hydrated through the canonical postInclude/serializePost (rank order restored in app).
 */
async function searchPosts(tsq: string, viewerId: string | undefined, limit: number, offset: number) {
  const viewer = viewerId ?? ''; // sentinel: matches no cuid

  const idRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT p.id
    FROM "Post" p
    WHERE p."searchVector" @@ to_tsquery('english', ${tsq})
      AND (
        p.visibility = 'PUBLIC'
        OR p."authorId" = ${viewer}
        OR (p.visibility = 'FOLLOWERS' AND EXISTS (
              SELECT 1 FROM "Follow" f
              WHERE f."followerId" = ${viewer} AND f."followingId" = p."authorId"))
      )
    ORDER BY ts_rank(p."searchVector", to_tsquery('english', ${tsq})) DESC, p.id ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const ids = idRows.map((r) => r.id);
  if (ids.length === 0) return [];

  const posts = await prisma.post.findMany({
    where: { id: { in: ids } },
    include: postInclude(viewerId),
  });

  // findMany loses the rank order — restore it from the id list.
  const rank = new Map(ids.map((id, i) => [id, i]));
  posts.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);

  // isFollowingAuthor per post — compute the follow-set once (avoids N+1).
  let followingSet = new Set<string>();
  if (viewerId) {
    const follows = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    followingSet = new Set(follows.map((f) => f.followingId));
  }

  return posts.map((p) =>
    serializePost(p, { isFollowingAuthor: viewerId ? followingSet.has(p.authorId) : false }),
  );
}

/** Search posts and/or users (type-scoped). The unselected array is empty. */
export async function search(input: SearchQuery, viewerId: string | undefined) {
  const { q, type, limit, offset } = input;
  const tsq = buildPrefixTsQuery(q);
  // No usable token (e.g. q was punctuation only) → nothing matches; skip the queries.
  if (tsq === '') return { posts: [], users: [] };

  const [posts, users] = await Promise.all([
    type === 'posts' || type === 'all' ? searchPosts(tsq, viewerId, limit, offset) : Promise.resolve([]),
    type === 'users' || type === 'all' ? searchUsers(tsq, limit, offset) : Promise.resolve([]),
  ]);
  return { posts, users };
}
