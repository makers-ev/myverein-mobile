import { ApiError } from './api';
import { privacyErrorKeyOr, addDaysKey, dayKey, flattenWards, isOwnClub, groupByDay, telUrl, isConsentTextOutdated, privacyErrorKey, wardKey } from './ward';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

describe('flattenWards', () => {
  it('flattens the per-club groups and tags each ward with its club', () => {
    const wards = flattenWards([
      { clubId: 'c1', clubName: 'TSV', wards: [{ wardId: 'w1', name: 'Mia Muster', firstName: 'Mia', openConsents: 2 }] },
      { clubId: 'c2', clubName: 'SC', wards: [{ wardId: 'w2', name: 'Ben Muster', firstName: 'Ben', openConsents: 0 }] },
    ]);
    expect(wards.map(wardKey)).toEqual(['c1:w1', 'c2:w2']);
    expect(wards[0]).toMatchObject({ clubName: 'TSV', openConsents: 2 });
  });
  it('yields nothing for a malformed answer (deny by default)', () => {
    expect(flattenWards(null)).toEqual([]);
    expect(flattenWards({})).toEqual([]);
    expect(flattenWards([{ clubId: 1 }, null, { clubId: 'c', wards: 'x' }])).toEqual([]);
  });
});

describe('day keys', () => {
  it('formats the local day and adds days across a month end', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDaysKey(new Date(2026, 0, 31), 14)).toBe('2026-02-14');
  });
});

describe('error mapping', () => {
  it('maps backend detail codes', () => {
    expect(privacyErrorKey(new ApiError(422, 'VALIDATION_ERROR', 'x', { code: 'period_too_long' }))).toBe('absence.error.too-long');
    expect(privacyErrorKey(new ApiError(403, 'FORBIDDEN', 'x', { code: 'consent_requires_guardian' }))).toBe('consent.error.requires-guardian');
    expect(privacyErrorKey(new ApiError(500, 'X', 'x'))).toBeNull();
    expect(privacyErrorKey(new Error('x'))).toBeNull();
  });
  it('detects an outdated consent text only on a 409 with the code', () => {
    expect(isConsentTextOutdated(new ApiError(409, 'CONFLICT', 'x', { code: 'consent_text_outdated' }))).toBe(true);
    expect(isConsentTextOutdated(new ApiError(409, 'CONFLICT', 'x'))).toBe(false);
    expect(isConsentTextOutdated(new ApiError(403, 'FORBIDDEN', 'x', { code: 'consent_text_outdated' }))).toBe(false);
  });
});

describe('groupByDay', () => {
  it('groups consecutive events of the same local day', () => {
    const e = (id: string, startsAt: string) => ({ id, startsAt });
    const groups = groupByDay([e('a', new Date(2026, 9, 22, 9).toISOString()), e('b', new Date(2026, 9, 22, 17).toISOString()), e('c', new Date(2026, 9, 23, 9).toISOString())]);
    expect(groups.map((g) => [g.day, g.events.length])).toEqual([['2026-10-22', 2], ['2026-10-23', 1]]);
  });
});

describe('telUrl', () => {
  it('keeps digits and a leading plus only', () => {
    expect(telUrl('+49 (170) 123-45 67')).toBe('tel:+491701234567');
  });
});

describe('isOwnClub', () => {
  it('does not count a guest-only membership', () => {
    expect(isOwnClub({ orgRole: 'guest' })).toBe(false);
    expect(isOwnClub({ orgRole: 'member' })).toBe(true);
    expect(isOwnClub({ orgRole: 'guest, owner' })).toBe(true);
    expect(isOwnClub({})).toBe(true);
  });
});

describe('privacyErrorKeyOr', () => {
  it('prefers the specific code, then the status text, then the fallback', () => {
    expect(privacyErrorKeyOr(new ApiError(400, 'X', 'x', { code: 'invalid_period' }), 'g')).toBe('absence.error.invalid-period');
    expect(privacyErrorKeyOr(new ApiError(403, 'DPA_REQUIRED', 'x', { code: 'dpa_required' }), 'g')).toBe('api.error.dpa-required');
    expect(privacyErrorKeyOr(new ApiError(429, 'TOO_MANY_REQUESTS', 'x'), 'g')).toBe('api.error.rate-limit');
    expect(privacyErrorKeyOr(new ApiError(503, 'X', 'x'), 'g')).toBe('api.error.server');
    expect(privacyErrorKeyOr(new Error('offline'), 'g')).toBe('g');
  });
});
