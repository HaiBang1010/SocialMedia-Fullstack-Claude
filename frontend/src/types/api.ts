// Hand-written API types. Must match backend response shapes 1:1.
// Backend reference: backend/src/modules/{auth,users,posts,feed,comments,likes,follows,media}/*.schema.ts
//
// Envelope note: Phase 1 (auth/users) WRAPS single resources as `{ user }`.
// Phase 2 (posts/comments) returns the resource BARE (no wrapper). List
// endpoints return an object `{ <items>, nextCursor }`. DELETE → 204 (void).

// ── Users ──────────────────────────────────────────────────────────────

// Public user shape — mirrors backend `publicUserSelect` / publicUserSchema
// (no email / passwordHash). Reused as post.author, comment.author, and
// follower/following list items.
export interface PublicUser {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: string; // ISO
}

// Authenticated self. Adds `email`, present only on own-profile responses
// (GET /auth/me, PATCH /users/me).
export interface User extends PublicUser {
  email?: string;
}

// Public profile DTO — only GET /users/:username returns this. PublicUser + social
// counts + the viewer's follow relationship. Kept separate from PublicUser so the
// lean 7-field shape (post.author / comment.author / list items) doesn't bloat.
// isFollowing: null for an anonymous viewer or self; true/false for a logged-in
// non-self viewer. postsCount mirrors what the profile grid actually shows.
export interface ProfileUser extends PublicUser {
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean | null;
}

// ── Auth ───────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// POST /auth/register, POST /auth/login
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// POST /auth/refresh — only a new access token, refresh token unchanged.
export interface RefreshResponse {
  accessToken: string;
}

// GET /auth/me, PATCH /users/me — Phase 1 wraps `{ user }` (self, may include email).
export interface UserResponse {
  user: User;
}

// GET /users/:username — wraps the public profile DTO. Also `{ user }`, but the
// user is a ProfileUser (counts + isFollowing), not the self User.
export interface ProfileResponse {
  user: ProfileUser;
}

// ── Posts ──────────────────────────────────────────────────────────────

export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type MediaType = 'IMAGE' | 'VIDEO'; // Phase 2 only produces IMAGE

// Item inside post.media (mirrors postMediaSchema).
export interface PostMedia {
  id: string;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null; // video poster, null for images
  duration: number | null; // video length in seconds, null for images
  width: number | null;
  height: number | null;
  order: number;
}

// GET /posts/:id, POST /posts, PATCH /posts/:id — returned BARE (no wrapper).
// Includes the 4 social fields from serializePost.
export interface Post {
  id: string;
  authorId: string;
  caption: string | null;
  visibility: PostVisibility;
  createdAt: string; // ISO
  author: PublicUser;
  media: PostMedia[];
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isFollowingAuthor: boolean;
}

// GET /users/:username/posts
export interface PostListResponse {
  posts: Post[];
  nextCursor: string | null;
}

// GET /feed — same shape as PostListResponse, kept distinct to match the wire.
export interface FeedResponse {
  posts: Post[];
  nextCursor: string | null;
}

// ── Comments ───────────────────────────────────────────────────────────

// POST /posts/:id/comments, PATCH /comments/:id — returned BARE.
// parentId is stored but Phase 2 renders comments flat.
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  createdAt: string; // ISO
  author: PublicUser;
}

// GET /posts/:id/comments — newest-first, cursor pagination.
export interface CommentListResponse {
  comments: Comment[];
  nextCursor: string | null;
}

// ── Likes / Follows ────────────────────────────────────────────────────

// POST/DELETE /posts/:id/like
export interface LikeResponse {
  liked: boolean;
  likesCount: number;
}

// POST/DELETE /users/:username/follow
export interface FollowResponse {
  following: boolean;
}

// GET /users/:username/followers, GET /users/:username/following
export interface UserListResponse {
  users: PublicUser[];
  nextCursor: string | null;
}

// ── Media (presigned upload) ───────────────────────────────────────────

// POST /media/presign — request. contentType union must stay in sync with
// the backend enum; size in bytes, backend cap is 10MB for images, 50MB for video.
export interface PresignRequest {
  contentType:
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/gif'
    | 'image/avif'
    | 'video/mp4';
  size: number;
}

// POST /media/presign — response.
export interface PresignResponse {
  uploadUrl: string; // presigned PUT URL (client uploads the file here)
  publicUrl: string; // URL to serve the object after upload
  objectKey: string; // key to persist with the post
  expiresIn: number; // seconds until uploadUrl expires
}

// ── Request inputs (mirror backend Zod input schemas) ──────────────────

// Media attached when creating a post (client already uploaded to S3).
export interface MediaInput {
  type?: MediaType; // backend defaults to IMAGE
  url: string;
  objectKey: string;
  thumbnailUrl?: string; // video poster URL (after uploading the poster)
  thumbnailObjectKey?: string; // poster S3 key, for deletePost cleanup
  duration?: number; // video length in seconds
  width?: number;
  height?: number;
}

// POST /posts — caption and/or media (backend requires at least one).
export interface CreatePostInput {
  caption?: string;
  visibility?: PostVisibility; // backend defaults to PUBLIC
  media?: MediaInput[]; // Phase 3.1: carousel, max 5
}

// PATCH /posts/:id
export interface UpdatePostInput {
  caption?: string;
  visibility?: PostVisibility;
}

// POST /posts/:id/comments
export interface CreateCommentInput {
  content: string;
  parentId?: string;
}

// PATCH /comments/:id
export interface UpdateCommentInput {
  content: string;
}

// Cursor pagination query params, shared by all list endpoints.
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

// ── Errors ─────────────────────────────────────────────────────────────

// Standard error body from backend middleware/error.ts.
// Note: backend names the code field "error", not "code".
export interface ApiError {
  error: string;
  message: string;
}

// Zod validation failures from middleware/validate.ts.
// details = ZodError.flatten().fieldErrors → field name → messages.
export interface ValidationError extends ApiError {
  error: 'ValidationError';
  details: Record<string, string[] | undefined>;
}
