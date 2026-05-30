import axios from 'axios';
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import type { ApiError, ValidationError } from '@/types/api';

// Narrow an unknown thrown value to the backend's standard error body.
// Backend names the code field "error" (not "code") — see types/api.ts.
export function getApiError(err: unknown): ApiError | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data.error === 'string' && typeof data.message === 'string') {
      return data as ApiError;
    }
  }
  return null;
}

export function getStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

// Zod failures from backend middleware/validate.ts carry `details`.
export function isValidationError(err: unknown): err is import('axios').AxiosError<ValidationError> {
  const api = getApiError(err);
  return (
    api?.error === 'ValidationError' &&
    typeof (api as ValidationError).details === 'object'
  );
}

// Map backend field errors (ValidationError.details) onto react-hook-form fields.
// Only sets errors for fields present in the form's value shape.
export function applyFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>
): boolean {
  if (!isValidationError(err)) return false;
  const details = (getApiError(err) as ValidationError).details;
  let applied = false;
  for (const [field, messages] of Object.entries(details)) {
    if (messages && messages.length > 0) {
      setError(field as Path<T>, { type: 'server', message: messages[0] });
      applied = true;
    }
  }
  return applied;
}
