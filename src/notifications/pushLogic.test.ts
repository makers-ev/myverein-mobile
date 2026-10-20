import {
  decidePushNavigation,
  environmentLimit,
  isPushTargetStale,
  needsRegistration,
  parsePushPayload,
  parseStoredRegistration,
  PUSH_TARGET_MAX_AGE_MS,
  REGISTRATION_REFRESH_MS,
  routeForTarget,
  statusFromPermission,
} from './pushLogic';

describe('parsePushPayload', () => {
  it('maps an announcement push', () => {
    expect(parsePushPayload({ type: 'announcement', urgent: false, clubId: 'c-1', announcementId: 'a-1' })).toEqual({
      kind: 'announcement',
      announcementId: 'a-1',
      clubId: 'c-1',
    });
  });

  it('maps an event push and falls back to the calendar without an id', () => {
    expect(parsePushPayload({ type: 'event', clubId: 'c', eventId: 'e-9' })).toEqual({ kind: 'event', eventId: 'e-9', clubId: 'c' });
    expect(parsePushPayload({ type: 'event', clubId: 'c' })).toEqual({ kind: 'calendar', clubId: 'c' });
  });

  it('opens the inbox for messages and reminders, the calendar for meetings', () => {
    expect(parsePushPayload({ type: 'message' })).toEqual({ kind: 'inbox', clubId: null });
    expect(parsePushPayload({ type: 'reminder', clubId: 'c' })).toEqual({ kind: 'inbox', clubId: 'c' });
    expect(parsePushPayload({ type: 'meeting', meetingId: 'm' })).toEqual({ kind: 'calendar', clubId: null });
  });

  it('ignores unknown or malformed payloads', () => {
    expect(parsePushPayload(null)).toBeNull();
    expect(parsePushPayload('x')).toBeNull();
    expect(parsePushPayload({})).toBeNull();
    expect(parsePushPayload({ type: 'unknown' })).toBeNull();
  });

  it('rejects ids that are not safe for a request path', () => {
    expect(parsePushPayload({ type: 'announcement', announcementId: '../x?y=1', clubId: 'a b' })).toEqual({ kind: 'inbox', clubId: null });
    expect(parsePushPayload({ type: 'event', eventId: 42 })).toEqual({ kind: 'calendar', clubId: null });
  });
});

describe('routing', () => {
  it('routes by target kind', () => {
    expect(routeForTarget({ kind: 'announcement', announcementId: 'a', clubId: null })).toBe('Mitteilungen');
    expect(routeForTarget({ kind: 'inbox', clubId: null })).toBe('Mitteilungen');
    expect(routeForTarget({ kind: 'event', eventId: 'e', clubId: null })).toBe('Kalender');
    expect(routeForTarget({ kind: 'calendar', clubId: null })).toBe('Kalender');
  });

  const target = { kind: 'event', eventId: 'e', clubId: null } as const;
  const ready = { navigationReady: true, authLoading: false, twoFactorPending: false, isAuthenticated: true };

  it('navigates when signed in', () => {
    expect(decidePushNavigation(target, ready)).toEqual({ action: 'navigate', route: 'Kalender' });
  });

  it('sends guests to Login with returnTo', () => {
    expect(decidePushNavigation(target, { ...ready, isAuthenticated: false })).toEqual({ action: 'login', returnTo: 'Kalender' });
  });

  it('waits for the navigator, the session bootstrap and a pending 2FA step', () => {
    expect(decidePushNavigation(target, { ...ready, navigationReady: false })).toEqual({ action: 'wait' });
    expect(decidePushNavigation(target, { ...ready, authLoading: true })).toEqual({ action: 'wait' });
    expect(decidePushNavigation(target, { ...ready, twoFactorPending: true, isAuthenticated: false })).toEqual({ action: 'wait' });
  });

  it('drops stale targets', () => {
    expect(isPushTargetStale(1000, 1000 + PUSH_TARGET_MAX_AGE_MS)).toBe(false);
    expect(isPushTargetStale(1000, 1001 + PUSH_TARGET_MAX_AGE_MS)).toBe(true);
  });
});

describe('registration state', () => {
  const env = { isWeb: false, isExpoGo: false, isDevice: true, hasProjectId: true };

  it('reports environment limits in priority order', () => {
    expect(environmentLimit(env)).toBeNull();
    expect(environmentLimit({ ...env, isWeb: true })).toBe('unsupported-web');
    expect(environmentLimit({ ...env, isExpoGo: true, isDevice: false })).toBe('unsupported-expo-go');
    expect(environmentLimit({ ...env, isDevice: false })).toBe('unsupported-simulator');
    expect(environmentLimit({ ...env, hasProjectId: false })).toBe('not-configured');
  });

  it('derives the status from permission and registration result', () => {
    expect(statusFromPermission('undetermined', false, false)).toBe('undetermined');
    expect(statusFromPermission('denied', true, false)).toBe('denied');
    expect(statusFromPermission('granted', true, false)).toBe('registered');
    expect(statusFromPermission('granted', false, false)).toBe('registering');
    expect(statusFromPermission('granted', false, true)).toBe('error');
  });

  it('registers on first use, new token, new account and after a day', () => {
    const stored = { token: 't', userId: 'u', at: 1000 };
    expect(needsRegistration(null, 't', 'u', 1000)).toBe(true);
    expect(needsRegistration(stored, 't2', 'u', 1001)).toBe(true);
    expect(needsRegistration(stored, 't', 'u2', 1001)).toBe(true);
    expect(needsRegistration(stored, 't', 'u', 1001)).toBe(false);
    expect(needsRegistration(stored, 't', 'u', 1000 + REGISTRATION_REFRESH_MS)).toBe(true);
  });

  it('parses stored registrations defensively', () => {
    expect(parseStoredRegistration(null)).toBeNull();
    expect(parseStoredRegistration('nope')).toBeNull();
    expect(parseStoredRegistration('{"token":1}')).toBeNull();
    expect(parseStoredRegistration('{"token":"t","userId":"u","at":5}')).toEqual({ token: 't', userId: 'u', at: 5 });
  });
});
