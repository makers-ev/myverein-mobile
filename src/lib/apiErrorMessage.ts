import { ApiError } from './api';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Localised text for a failed API call. Backend `message`s are English
 * developer text and must never reach the UI: the text is chosen from the
 * backend error `code` (then the HTTP status); anything else falls back to
 * `fallbackKey` (default: the generic error text).
 */
export function apiErrorKey(err: unknown, fallbackKey = 'alert.general-error-description'): string {
  if (!(err instanceof ApiError)) return fallbackKey;
  switch (err.code) {
    case 'ALREADY_MEMBER':
      return 'api.error.already-member';
    case 'APPLICATION_PENDING':
      return 'api.error.application-pending';
    case 'QUOTA_EXCEEDED':
      return 'api.error.quota';
    case 'TOO_MANY_REQUESTS':
      return 'api.error.rate-limit';
    default:
      break;
  }
  if (err.status === 401) return 'api.error.unauthorized';
  if (err.status === 403) return 'api.error.forbidden';
  if (err.status === 404) return 'api.error.not-found';
  if (err.status === 409) return 'api.error.conflict';
  if (err.status === 400 || err.status === 422) return 'api.error.invalid';
  if (err.status === 429) return 'api.error.rate-limit';
  if (err.status >= 500) return 'api.error.server';
  return fallbackKey;
}

export function apiErrorMessage(err: unknown, t: Translate, fallbackKey?: string): string {
  return t(apiErrorKey(err, fallbackKey));
}
