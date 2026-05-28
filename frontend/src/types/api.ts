// Hand-written API types for Phase 1A. Must match backend response shapes.
// Backend reference: backend/src/modules/{auth,users}/*.ts
// Phase 1B may switch to auto-gen from /docs/json.

export interface User {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: string;
  // Present only on PATCH /users/me response (own profile).
  email?: string;
}

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

// GET /auth/me, GET /users/:username, PATCH /users/me
export interface UserResponse {
  user: User;
}

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
