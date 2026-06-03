// Central query-key factory for TanStack Query. One source of truth so cache
// reads, invalidation, and (Phase 2.4b) optimistic updates all agree on keys.
//
// Keys are hierarchical to enable prefix invalidation, e.g.
//   queryClient.invalidateQueries({ queryKey: ['posts'] })  // all post data
//   queryClient.invalidateQueries({ queryKey: queryKeys.post(id) }) // one post
//
// `as const` keeps each key a readonly literal tuple for type-safe matching.
export const queryKeys = {
  // Current authenticated user (GET /auth/me).
  me: () => ['me'] as const,

  // Public profile (GET /users/:username).
  user: (username: string) => ['users', username] as const,

  // A user's posts (GET /users/:username/posts).
  userPosts: (username: string) => ['users', username, 'posts'] as const,

  // Follower / following lists (GET /users/:username/{followers,following}).
  followers: (username: string) => ['users', username, 'followers'] as const,
  following: (username: string) => ['users', username, 'following'] as const,

  // Personalized feed (GET /feed).
  feed: () => ['feed'] as const,

  // Single post (GET /posts/:id).
  post: (id: string) => ['posts', id] as const,

  // A post's comments (GET /posts/:id/comments).
  comments: (postId: string) => ['posts', postId, 'comments'] as const,
};
