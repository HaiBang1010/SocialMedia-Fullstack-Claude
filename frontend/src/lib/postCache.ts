// Cache surgery for a single Post. A post lives in up to three caches at once:
//   - queryKeys.post(id)            → the bare Post
//   - queryKeys.feed()              → InfiniteData<FeedResponse>
//   - queryKeys.userPosts(username) → InfiniteData<PostListResponse>
//
// Mutations (like / unlike / new comment) must keep all three in sync, so the
// patch logic lives here once instead of being duplicated per hook.

import type {
  InfiniteData,
  Query,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';
import type { FeedResponse, Post, PostListResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

type PostUpdater = (post: Post) => Post;

// Matches every userPosts cache regardless of username (the key is dynamic, so
// we can't address it by an exact key — we sweep and let the mapper no-op the
// lists that don't contain the post). Key shape: ['users', <username>, 'posts'].
export function userPostsPredicate(query: Query): boolean {
  const key = query.queryKey;
  return key[0] === 'users' && key[2] === 'posts' && key.length === 3;
}

// Apply `updater` to the matching post inside an infinite list, cloning only the
// pages/arrays that actually change. Returns the SAME reference when nothing
// matched so React Query doesn't notify observers (avoids re-rendering the feed
// for a post it doesn't hold).
function mapPostInInfinite<T extends { posts: Post[] }>(
  data: InfiniteData<T> | undefined,
  postId: string,
  updater: PostUpdater,
): InfiniteData<T> | undefined {
  if (!data) return data;
  let touched = false;
  const pages = data.pages.map((page) => {
    let pageTouched = false;
    const posts = page.posts.map((p) => {
      if (p.id !== postId) return p;
      pageTouched = true;
      touched = true;
      return updater(p);
    });
    return pageTouched ? { ...page, posts } : page;
  });
  return touched ? { ...data, pages } : data;
}

// Drop a post from an infinite list, cloning only the pages/arrays that change.
// Returns the SAME reference when the post wasn't present so React Query doesn't
// notify observers of lists that don't hold it.
function removePostFromInfinite<T extends { posts: Post[] }>(
  data: InfiniteData<T> | undefined,
  postId: string,
): InfiniteData<T> | undefined {
  if (!data) return data;
  let touched = false;
  const pages = data.pages.map((page) => {
    const posts = page.posts.filter((p) => p.id !== postId);
    if (posts.length === page.posts.length) return page;
    touched = true;
    return { ...page, posts };
  });
  return touched ? { ...data, pages } : data;
}

// Remove a post from the feed + every userPosts list (used by delete). The single
// post(id) cache is handled separately by the caller (kept until navigation so an
// open detail view doesn't flash "not found", then removeQueries on success).
export function removePostFromLists(qc: QueryClient, postId: string): void {
  qc.setQueriesData<InfiniteData<FeedResponse>>(
    { queryKey: queryKeys.feed() },
    (data) => removePostFromInfinite(data, postId),
  );
  qc.setQueriesData<InfiniteData<PostListResponse>>(
    { predicate: userPostsPredicate },
    (data) => removePostFromInfinite(data, postId),
  );
}

// Patch a post everywhere it's cached. Synchronous; a no-op for any cache that
// doesn't currently hold the post.
export function patchPostInCaches(
  qc: QueryClient,
  postId: string,
  updater: PostUpdater,
): void {
  qc.setQueryData<Post>(queryKeys.post(postId), (prev) =>
    prev ? updater(prev) : prev,
  );
  qc.setQueriesData<InfiniteData<FeedResponse>>(
    { queryKey: queryKeys.feed() },
    (data) => mapPostInInfinite(data, postId, updater),
  );
  qc.setQueriesData<InfiniteData<PostListResponse>>(
    { predicate: userPostsPredicate },
    (data) => mapPostInInfinite(data, postId, updater),
  );
}

// Snapshot of all three caches for a post, captured in onMutate so onError can
// roll an optimistic update back verbatim.
export interface PostCacheSnapshot {
  postKey: QueryKey;
  post: Post | undefined;
  feed: Array<[QueryKey, InfiniteData<FeedResponse> | undefined]>;
  userPosts: Array<[QueryKey, InfiniteData<PostListResponse> | undefined]>;
}

export function snapshotPostCaches(
  qc: QueryClient,
  postId: string,
): PostCacheSnapshot {
  return {
    postKey: queryKeys.post(postId),
    post: qc.getQueryData<Post>(queryKeys.post(postId)),
    feed: qc.getQueriesData<InfiniteData<FeedResponse>>({
      queryKey: queryKeys.feed(),
    }),
    userPosts: qc.getQueriesData<InfiniteData<PostListResponse>>({
      predicate: userPostsPredicate,
    }),
  };
}

export function restorePostCaches(
  qc: QueryClient,
  snap: PostCacheSnapshot,
): void {
  qc.setQueryData(snap.postKey, snap.post);
  for (const [key, data] of snap.feed) qc.setQueryData(key, data);
  for (const [key, data] of snap.userPosts) qc.setQueryData(key, data);
}
