import { apiClient } from './client';
import { uploadClient } from './upload-client';
import type { PresignRequest, PresignResponse } from '@/types/api';

export const mediaApi = {
  // Ask the backend for a presigned PUT URL. The file is NOT sent here — only
  // its contentType + size. Upload happens separately via uploadToPresignedUrl.
  presign: async (input: PresignRequest): Promise<PresignResponse> => {
    const { data } = await apiClient.post<PresignResponse>(
      '/media/presign',
      input
    );
    return data;
  },
};

// Upload a file straight to S3/MinIO using a presigned PUT URL.
// Uses uploadClient (no JWT, no refresh interceptor). Content-Type must match
// the contentType signed in the presign request, so it is sent from file.type.
// onProgress reports 0–100 (undefined when the total length is unknown).
export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  await uploadClient.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
}
