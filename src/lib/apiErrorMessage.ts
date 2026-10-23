import { ApiError } from './api';

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

export function apiErrorKey(err: unknown, fallbackKey = 'alert.general-error-description'): string {
  if (!(err instanceof ApiError)) return fallbackKey;
  // Machine-readable conflicts carry `details.code`; it wins over the generic status text.
  const detailsCode = (err.details as { code?: unknown } | undefined)?.code;
  if (detailsCode === 'default_calendar_required') return 'kalender.error.default-required';
  const erasure = erasureBlockerKey(err.code);
  if (erasure) return erasure;
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
