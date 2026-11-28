jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import { hintFailure, hintRequest, sortedNames } from './availabilityHints';

describe('availability hints helpers', () => {
  const base = { clubId: 'club', calendarId: 'cal', startsAt: '2026-06-10T16:00:00.000Z', endsAt: '2026-06-10T18:00:00.000Z' };

  it('builds the request path with the optional end and event', () => {
    const r = hintRequest({ ...base, eventId: 'e1' });
    expect(r.kind).toBe('query');
    if (r.kind === 'query') {
      expect(r.path).toContain('/events/availability-hints?');
      expect(r.path).toContain('clubId=club');
      expect(r.path).toContain('calendarId=cal');
      expect(r.path).toContain('eventId=e1');
      expect(r.path).toContain('endsAt=');
    }
    const noEnd = hintRequest({ ...base, endsAt: null });
    expect(noEnd.kind === 'query' && noEnd.path.includes('endsAt')).toBe(false);
  });

  it('skips incomplete input and ranges beyond 14 days', () => {
    expect(hintRequest({ ...base, calendarId: null })).toEqual({ kind: 'skip', reason: 'incomplete' });
    expect(hintRequest({ ...base, startsAt: null })).toEqual({ kind: 'skip', reason: 'incomplete' });
    expect(hintRequest({ ...base, endsAt: '2026-06-10T15:00:00.000Z' })).toEqual({ kind: 'skip', reason: 'incomplete' });
    expect(hintRequest({ ...base, endsAt: '2026-06-30T18:00:00.000Z' })).toEqual({ kind: 'skip', reason: 'range' });
    expect(hintRequest({ ...base, endsAt: '2026-06-24T16:00:00.000Z' }).kind).toBe('query');
  });

  it('classifies failures', () => {
    expect(hintFailure(new ApiError(403, 'FORBIDDEN', 'x'))).toBe('forbidden');
    expect(hintFailure(new ApiError(429, 'RATE', 'x'))).toBe('rate');
    expect(hintFailure(new ApiError(422, 'X', 'x', { code: 'range_too_long' }))).toBe('range');
    expect(hintFailure(new ApiError(500, 'X', 'x'))).toBe('error');
    expect(hintFailure(new Error('boom'))).toBe('error');
  });

  it('sorts names and tolerates none', () => {
    expect(sortedNames({ unavailablePeople: null })).toEqual([]);
    expect(sortedNames({ unavailablePeople: [{ clubMemberId: '2', displayName: 'Zoe' }, { clubMemberId: '1', displayName: 'Anna' }] })).toEqual(['Anna', 'Zoe']);
  });
});
