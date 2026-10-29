import { ApiError, isNetworkFailure } from './api';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Localised text for a failed API call. Backend `message`s are English
 * developer text and must never reach the UI: the text is chosen from the
 * backend error `code` (then the HTTP status); anything else falls back to
 * `fallbackKey` (default: the generic error text).
 */
/**
 * Account deletion is refused (400) with `ERASURE_<BLOCKER>` while something in a club still depends on the account.
 * Returns the German-first message key for a known blocker, `null` for anything else.
 */
export function erasureBlockerKey(code: unknown): string | null {
  if (typeof code !== 'string' || !code.startsWith('ERASURE_')) return null;
  switch (code) {
    case 'ERASURE_LEGAL_HOLD':
      return 'erasure.blocker.legal-hold';
    case 'ERASURE_EXIT_PENDING':
      return 'erasure.blocker.exit-pending';
    case 'ERASURE_OPEN_LOANS':
      return 'erasure.blocker.open-loans';
    case 'ERASURE_BOARD_ROLE':
      return 'erasure.blocker.board-role';
    case 'ERASURE_APPLICATION_PENDING':
      return 'erasure.blocker.application-pending';
    case 'ERASURE_SOLE_OWNER':
      return 'erasure.blocker.sole-owner';
    default:
      return 'erasure.blocker.other';
  }
}

/** Anything carrying a machine-readable error: an `ApiError` or an auth result (`{ code, status }`). */
interface ErrorLike {
  code?: unknown;
  status?: unknown;
}

/**
 * Backend (snake_case, Wave 14 DS2) and Better Auth (UPPER_SNAKE) error codes with their own, more helpful text than
 * the generic status fallback. Everything not listed falls back to the HTTP status text, then to the caller's key.
 */
const CODE_KEYS: Record<string, string> = {
  query_too_short: 'api.error.query-too-short',
  QUERY_TOO_SHORT: 'api.error.query-too-short',
  INVALID_EMAIL_OR_PASSWORD: 'auth.error.invalid-credentials',
  EMAIL_NOT_VERIFIED: 'auth.error.email-not-verified',
  USER_ALREADY_EXISTS: 'auth.error.user-exists',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'auth.error.user-exists',
  INVALID_PASSWORD: 'auth.error.invalid-password',
  PASSWORD_TOO_SHORT: 'auth.error.password-short',
  PASSWORD_TOO_LONG: 'auth.error.password-long',
  INVALID_EMAIL: 'auth.error.invalid-email',
  INVALID_TWO_FACTOR_COOKIE: 'auth.error.two-factor-expired',
  INVALID_CODE: 'auth.error.two-factor-code',
  INVALID_TOKEN: 'auth.error.token-invalid',
};

/** True when the request never reached the server (no connection, timeout): status 0, or a network-level failure. */
export function isOfflineError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0;
  if (err instanceof Error) return isNetworkFailure(err);
  return !!err && typeof err === 'object' && (err as ErrorLike).status === 0;
}

export function apiErrorKey(err: unknown, fallbackKey = 'alert.general-error-description'): string {
  if (isOfflineError(err)) return 'api.error.offline';
  // Auth results (`{ code, status }`, no Error instance) share the same mapping.
  if (err && typeof err === 'object' && !(err instanceof Error)) {
    const { code, status } = err as ErrorLike;
    if (typeof code === 'string' && CODE_KEYS[code]) return CODE_KEYS[code]!;
    return typeof status === 'number' ? apiErrorKey(new ApiError(status, typeof code === 'string' ? code : 'UNKNOWN', ''), fallbackKey) : fallbackKey;
  }
  if (!(err instanceof ApiError)) return fallbackKey;
  // Machine-readable conflicts carry `details.code`; it wins over the generic status text.
  const detailsCode = (err.details as { code?: unknown } | undefined)?.code;
  if (detailsCode === 'default_calendar_required') return 'kalender.error.default-required';
  const erasure = erasureBlockerKey(err.code);
  if (erasure) return erasure;
  if (CODE_KEYS[err.code]) return CODE_KEYS[err.code]!;
  switch (err.code) {
    case 'ALREADY_MEMBER':
      return 'api.error.already-member';
    case 'APPLICATION_PENDING':
      return 'api.error.application-pending';
    case 'QUOTA_EXCEEDED':
      return 'api.error.quota';
    case 'DPA_REQUIRED':
      return 'api.error.dpa-required';
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
