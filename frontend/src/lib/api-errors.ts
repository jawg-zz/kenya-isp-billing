/**
 * API error handling utilities
 * Extracts meaningful error messages from API responses
 */

interface ApiErrorResponse {
  response?: {
    status: number;
    data?: {
      message?: string;
      errors?: Record<string, string[]> | Array<{ field: string; message: string }>;
      error?: string;
    };
  };
  message?: string;
}

/**
 * Extract a user-friendly error message from an API error response.
 * Maps HTTP status codes to appropriate messages and surfaces
 * field-level validation errors when available.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const error = err as ApiErrorResponse;

  // Network / timeout
  if (!error.response) {
    if (error.message === 'Network Error') {
      return 'Network error. Please check your connection and try again.';
    }
    if (error.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    return fallback;
  }

  const { status, data } = error.response;

  switch (status) {
    case 400: {
      // Field-level validation errors from backend
      if (data?.errors) {
        const errs = data.errors;
        // errors can be Record<string, string[]> or Array<{field, message}>
        if (Array.isArray(errs)) {
          return errs.map(e => e.message).join('. ');
        }
        const messages = Object.values(errs).flat();
        if (messages.length > 0) {
          return messages.join('. ');
        }
      }
      return data?.message || data?.error || 'Invalid request. Please check your input.';
    }

    case 401:
      return 'Invalid credentials. Please check your email and password.';

    case 403:
      return 'You don\'t have permission to perform this action.';

    case 404:
      return data?.message || 'The requested resource was not found.';

    case 409:
      return data?.message || 'This email or phone number is already registered.';

    case 422:
      // Validation errors
      if (data?.errors) {
        const errs = data.errors;
        if (Array.isArray(errs)) {
          return errs.map(e => e.message).join('. ');
        }
        const messages = Object.values(errs).flat();
        if (messages.length > 0) {
          return messages.join('. ');
        }
      }
      return data?.message || 'Please check your input and try again.';

    case 429: {
      return data?.message || 'Too many attempts. Please wait a few minutes and try again.';
    }

    case 500:
    case 502:
    case 503:
      return 'Something went wrong on our end. Please try again later.';

    default:
      return data?.message || data?.error || fallback;
  }
}

/**
 * Extract field-level errors from an API response.
 * Returns a Record<string, string> suitable for setting inline field errors.
 *
 * Works with:
 * - Array format: [{ field: 'email', message: 'Invalid email' }]
 * - Record format: { email: ['Invalid email'], phone: ['Required'] }
 */
export function getApiFieldErrors(err: unknown): Record<string, string> {
  const error = err as ApiErrorResponse;
  const errors = error.response?.data?.errors;

  if (!errors) return {};

  if (Array.isArray(errors)) {
    const result: Record<string, string> = {};
    for (const e of errors) {
      if (e.field && e.message) {
        // Take the first error per field
        if (!result[e.field]) {
          result[e.field] = e.message;
        }
      }
    }
    return result;
  }

  // Record<string, string[]> format
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      result[field] = messages[0];
    } else if (typeof messages === 'string') {
      result[field] = messages;
    }
  }
  return result;
}
