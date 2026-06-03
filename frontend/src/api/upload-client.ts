import axios from 'axios';

// Bare axios instance for uploading a file directly to S3/MinIO through a
// presigned PUT URL.
//
// Deliberately separate from `apiClient`: the presigned URL carries its own
// signature, so this client must NOT attach our JWT `Authorization` header
// (it would break the S3 signature) and must NOT run the 401-refresh/retry
// interceptor. No baseURL — callers pass the absolute presigned URL.
export const uploadClient = axios.create();
