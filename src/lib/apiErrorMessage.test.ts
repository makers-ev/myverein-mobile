import { ApiError, apiErrorFromResponse } from './api';
import { apiErrorKey, apiErrorMessage } from './apiErrorMessage';

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
