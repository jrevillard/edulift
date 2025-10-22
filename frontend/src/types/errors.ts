export interface ApiError {
  response?: {
    status?: number;
    message?: string;
    data?: {
      error?: string;
    };
  };
  message?: string;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    error !== null &&
    typeof error === 'object' &&
    ('response' in error || 'message' in error)
  );
}