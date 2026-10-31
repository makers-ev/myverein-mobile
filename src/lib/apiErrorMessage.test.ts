import { ApiError, apiErrorFromResponse } from './api';
import { mapApiError } from './mapApiError';
import { apiErrorKey, apiErrorMessage, erasureBlockerKey, isOfflineError } from './apiErrorMessage';
import { RequestTimeoutError } from './withTimeout';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

describe('apiErrorKey', () => {
  it('prefers the backend code', () => {
    expect(apiErrorKey(new ApiError(409, 'ALREADY_MEMBER', 'You are already a member'))).toBe('api.error.already-member');
    expect(apiErrorKey(new ApiError(413, 'QUOTA_EXCEEDED', 'x'))).toBe('api.error.quota');
  });
  it('maps default_calendar_required from details.code', () => {
    expect(apiErrorKey(new ApiError(409, 'CONFLICT', 'x', { code: 'default_calendar_required' }))).toBe('kalender.error.default-required');
    expect(apiErrorKey(new ApiError(409, 'CONFLICT', 'x', { code: 'other' }))).toBe('api.error.conflict');
  });
  it('falls back to the HTTP status', () => {
    expect(apiErrorKey(new ApiError(403, 'FORBIDDEN', 'x'))).toBe('api.error.forbidden');
    expect(apiErrorKey(new ApiError(422, 'UNPROCESSABLE_ENTITY', 'x'))).toBe('api.error.invalid');
    expect(apiErrorKey(new ApiError(503, 'X', 'x'))).toBe('api.error.server');
  });
  it('uses the given fallback for unknown statuses and non-API errors', () => {
    expect(apiErrorKey(new ApiError(418, 'X', 'x'), 'custom.key')).toBe('custom.key');
    expect(apiErrorKey(new Error('boom'))).toBe('alert.general-error-description');
  });
  it('never returns the raw backend message', () => {
    const t = (key: string) => `[${key}]`;
    expect(apiErrorMessage(new ApiError(404, 'NOT_FOUND', 'Exit request not found'), t)).toBe('[api.error.not-found]');
  });
});

describe('DPA_REQUIRED and account deletion blockers', () => {
  it('shows a readable message for the club-wide DPA lock, not the generic forbidden text', () => {
    expect(apiErrorKey(new ApiError(403, 'DPA_REQUIRED', 'Processor agreement missing', { code: 'dpa_required' }))).toBe('api.error.dpa-required');
    expect(apiErrorKey(new ApiError(403, 'FORBIDDEN', 'x'))).toBe('api.error.forbidden');
  });
  it('maps every ERASURE_<BLOCKER> code and falls back for unknown ones', () => {
    expect(erasureBlockerKey('ERASURE_SOLE_OWNER')).toBe('erasure.blocker.sole-owner');
    expect(erasureBlockerKey('ERASURE_OPEN_LOANS')).toBe('erasure.blocker.open-loans');
    expect(erasureBlockerKey('ERASURE_LEGAL_HOLD')).toBe('erasure.blocker.legal-hold');
    expect(erasureBlockerKey('ERASURE_EXIT_PENDING')).toBe('erasure.blocker.exit-pending');
    expect(erasureBlockerKey('ERASURE_BOARD_ROLE')).toBe('erasure.blocker.board-role');
    expect(erasureBlockerKey('ERASURE_APPLICATION_PENDING')).toBe('erasure.blocker.application-pending');
    expect(erasureBlockerKey('ERASURE_SOMETHING_NEW')).toBe('erasure.blocker.other');
    expect(erasureBlockerKey('INVALID_PASSWORD')).toBeNull();
    expect(erasureBlockerKey(undefined)).toBeNull();
  });
  it('maps an ERASURE code through apiErrorKey too', () => {
    expect(apiErrorKey(new ApiError(400, 'ERASURE_SOLE_OWNER', 'x'))).toBe('erasure.blocker.sole-owner');
  });
});

describe('apiErrorFromResponse', () => {
  it('parses the nested backend envelope', () => {
    const err = apiErrorFromResponse(403, JSON.stringify({ error: { code: 'FORBIDDEN', message: 'x', details: { a: 1 } } }));
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.details).toEqual({ a: 1 });
  });

  it('falls back to UNKNOWN for an empty or broken body', () => {
    expect(apiErrorFromResponse(500, null).code).toBe('UNKNOWN');
    expect(apiErrorFromResponse(502, '<html>').code).toBe('UNKNOWN');
  });
});

describe('mapApiError (Wave 14 DS2)', () => {
  const t = (key: string) => `[${key}]`;
  it('maps stable backend codes and auth results without echoing server text', () => {
    expect(mapApiError(new ApiError(400, 'query_too_short', 'Query too short'), t)).toBe('[api.error.query-too-short]');
    expect(mapApiError(new ApiError(400, 'QUERY_TOO_SHORT', 'x'), t)).toBe('[api.error.query-too-short]');
    expect(mapApiError({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401, error: 'Unable to sign in.' }, t)).toBe('[auth.error.invalid-credentials]');
    expect(mapApiError({ status: 429 }, t)).toBe('[api.error.rate-limit]');
    expect(mapApiError({ error: 'x' }, t, 'custom.key')).toBe('[custom.key]');
  });
  it('shows a no-connection text for network failures', () => {
    expect(mapApiError(new ApiError(0, 'UNKNOWN', 'Failed to fetch'), t)).toBe('[api.error.offline]');
    expect(mapApiError(new TypeError('Network request failed'), t)).toBe('[api.error.offline]');
    expect(mapApiError({ status: 0 }, t)).toBe('[api.error.offline]');
  });
});

describe('network failures (Wave 14 N5)', () => {
  it('apiFetch-level network errors become status 0 and map to the offline text', () => {
    const t = (key: string) => `[${key}]`;
    expect(mapApiError(new ApiError(0, 'NETWORK_ERROR', 'Network request failed'), t)).toBe('[api.error.offline]');
  });
});

describe('offline detection (narrow)', () => {
  it('counts only TypeError, "Network request failed" and the own timeout as offline', () => {
    expect(isOfflineError(new TypeError('Network request failed'))).toBe(true);
    expect(isOfflineError(new Error('Network request failed'))).toBe(true);
    expect(isOfflineError(new RequestTimeoutError())).toBe(true);
    expect(isOfflineError(new Error('request timed out by the server proxy'))).toBe(false);
    expect(isOfflineError(new Error('aborted'))).toBe(false);
    expect(isOfflineError(new ApiError(500, 'X', 'x'))).toBe(false);
  });
});
