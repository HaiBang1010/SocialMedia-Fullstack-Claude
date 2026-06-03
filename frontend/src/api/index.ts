// Barrel for the API layer. Import from '@/api' instead of deep paths.
// Each *.ts here is a thin HTTP wrapper (no business logic / no cache);
// composition with TanStack Query lives in features/*/hooks.

// Axios instances
export { apiClient } from './client';
export { uploadClient } from './upload-client';

// API objects
export { authApi, type RegisterInput } from './auth';
export { usersApi, type UpdateProfileInput } from './users';
export { mediaApi, uploadToPresignedUrl } from './media';
export { postsApi } from './posts';
export { feedApi } from './feed';
export { commentsApi } from './comments';
export { likesApi } from './likes';
export { followsApi } from './follows';
