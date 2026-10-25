/**
 * Pure push logic (Wave 9 M2/M3): payload parsing, routing decisions and registration state.
 * No React, no native modules, no logging -- payloads and tokens must never end up in logs.
 */

// --- Payload (M3) ---------------------------------------------------------------------------

/** What a tapped push wants to open. Built only from the backend's id-only `data` object. */
export type PushTarget =
  | { kind: 'announcement'; announcementId: string; clubId: string | null }
  | { kind: 'event'; eventId: string; clubId: string | null }
  | { kind: 'inbox'; clubId: string | null }
  | { kind: 'calendar'; clubId: string | null; tab?: CalendarTabHint }
  | { kind: 'ballot'; clubId: string | null; ballotId: string | null }
  | { kind: 'assembly'; clubId: string | null; meetingId: string };

/** Which Kalender tab a calendar target opens (default: Termine). */
export type CalendarTabHint = 'treffen';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function safeId(value: unknown): string | null {
  return typeof value === 'string' && ID_PATTERN.test(value) ? value : null;
}

/**
 * Backend payload: `data = { type: announcement|event|meeting|reminder|message, urgent, clubId,
 * announcementId?, eventId?, meetingId? }`. Anything unknown or malformed yields `null`
 * (the tap is ignored); ids are validated so they can safely go into a request path.
 */
export function parsePushPayload(data: unknown): PushTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const clubId = safeId(d.clubId);
  switch (d.type) {
    case 'announcement': {
      const announcementId = safeId(d.announcementId);
      return announcementId ? { kind: 'announcement', announcementId, clubId } : { kind: 'inbox', clubId };
    }
    case 'event': {
      const eventId = safeId(d.eventId);
      return eventId ? { kind: 'event', eventId, clubId } : { kind: 'calendar', clubId };
    }
    // Wave 11: a call to vote / an assembly; ids only, never a title or a choice.
    case 'ballot':
      return { kind: 'ballot', clubId, ballotId: safeId(d.ballotId) };
    case 'assembly': {
      const meetingId = safeId(d.meetingId);
      return meetingId ? { kind: 'assembly', clubId, meetingId } : { kind: 'inbox', clubId };
    }
    case 'meeting':
      return { kind: 'calendar', clubId, tab: 'treffen' };
    case 'reminder':
    case 'message':
      return { kind: 'inbox', clubId };
    default:
      return null;
  }
}

export type PushRoute = 'Mitteilungen' | 'Kalender' | 'Abstimmungen' | 'Versammlung';

export function routeForTarget(target: PushTarget): PushRoute {
  if (target.kind === 'ballot') return 'Abstimmungen';
  if (target.kind === 'assembly') return 'Versammlung';
  return target.kind === 'event' || target.kind === 'calendar' ? 'Kalender' : 'Mitteilungen';
}

export type PushNavigationDecision =
  | { action: 'wait' }
  | { action: 'login'; returnTo: PushRoute }
  | { action: 'navigate'; route: PushRoute };

/** A tap older than this is dropped instead of surprising the user minutes later (e.g. after a long login). */
export const PUSH_TARGET_MAX_AGE_MS = 10 * 60 * 1000;

export function isPushTargetStale(receivedAt: number, now: number): boolean {
  return now - receivedAt > PUSH_TARGET_MAX_AGE_MS;
}

export function decidePushNavigation(
  target: PushTarget,
  state: { navigationReady: boolean; authLoading: boolean; twoFactorPending: boolean; isAuthenticated: boolean },
): PushNavigationDecision {
  // Cold start: the navigator is not mounted before the session bootstrap; mid-2FA there is no Login/Mitteilungen route.
  if (!state.navigationReady || state.authLoading || state.twoFactorPending) return { action: 'wait' };
  const route = routeForTarget(target);
  return state.isAuthenticated ? { action: 'navigate', route } : { action: 'login', returnTo: route };
}

export type AnnouncementLookup = 'found' | 'gone' | 'unknown';

/**
 * Whether a tapped announcement is in the loaded inbox page. A full page means older messages were
 * not loaded, so a miss is 'unknown' (softer notice) rather than 'gone'.
 */
export function lookupAnnouncement(
  list: { announcementId: string | null }[],
  announcementId: string,
  pageSize: number,
): AnnouncementLookup {
  if (list.some((m) => m.announcementId === announcementId)) return 'found';
  return list.length >= pageSize ? 'unknown' : 'gone';
}

/** Which targets a screen consumes (Mitteilungen: announcements + inbox, Kalender: events + calendar). */
export function targetBelongsTo(target: PushTarget, route: PushRoute): boolean {
  return routeForTarget(target) === route;
}

// --- Registration (M2) ----------------------------------------------------------------------

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export type PushStatus =
  | 'unsupported-web' // web build
  | 'unsupported-expo-go' // Expo Go cannot receive remote push on current SDKs -> dev build / EAS
  | 'unsupported-simulator' // simulators/emulators have no push token
  | 'not-configured' // no EAS project id in the app config
  | 'undetermined' // permission not asked yet
  | 'denied' // user said no -> device settings
  | 'registering'
  | 'registered'
  | 'error'; // token or backend registration failed; retried on next foreground

export interface PushEnvironment {
  isWeb: boolean;
  isExpoGo: boolean;
  isDevice: boolean;
  hasProjectId: boolean;
}

/** The environment limits come first; they are independent of permission and of the account. */
export function environmentLimit(env: PushEnvironment): PushStatus | null {
  if (env.isWeb) return 'unsupported-web';
  if (env.isExpoGo) return 'unsupported-expo-go';
  if (!env.isDevice) return 'unsupported-simulator';
  if (!env.hasProjectId) return 'not-configured';
  return null;
}

export function isUnsupported(status: PushStatus): boolean {
  return status.startsWith('unsupported') || status === 'not-configured';
}

export function statusFromPermission(permission: PushPermission, registered: boolean, failed: boolean): PushStatus {
  if (permission === 'denied') return 'denied';
  if (permission === 'undetermined') return 'undetermined';
  if (registered) return 'registered';
  return failed ? 'error' : 'registering';
}

/** A token whose backend removal failed (logout offline, session lost); only the token, retried while signed in. */
export interface PendingUnregister {
  token: string;
}

export function parsePendingUnregister(raw: string | null): PendingUnregister | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingUnregister>;
    if (typeof v.token === 'string' && v.token) return { token: v.token };
  } catch {
    // fall through
  }
  return null;
}

/** A failed `DELETE /push-tokens/:token` is retried unless the backend answered definitively (4xx except timeout/rate limit). */
export function isRetryableUnregisterFailure(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/**
 * A registration request may only touch the backend / storage while the account and the
 * logout generation it started with are still current (logout or session loss bumps the epoch).
 */
export function isRegistrationCurrent(
  started: { epoch: number; userId: string },
  now: { epoch: number; userId: string | null; unregistering: boolean },
): boolean {
  return !now.unregistering && started.epoch === now.epoch && started.userId === now.userId;
}

/** Shows 'registering' only while no token is registered yet; a routine re-sync keeps 'registered'. */
export function nextRegisteringStatus(previous: PushStatus): PushStatus {
  return previous === 'registered' ? previous : 'registering';
}

/** What this install last registered with the backend (kept in the secure store so logout can unregister). */
export interface StoredRegistration {
  token: string;
  userId: string;
  at: number;
}

export const REGISTRATION_REFRESH_MS = 24 * 60 * 60 * 1000;

/** The backend limits registrations per hour, so the same token is only re-sent once a day. */
export function needsRegistration(stored: StoredRegistration | null, token: string, userId: string, now: number): boolean {
  if (!stored) return true;
  if (stored.token !== token || stored.userId !== userId) return true;
  return now - stored.at >= REGISTRATION_REFRESH_MS;
}

export function parseStoredRegistration(raw: string | null): StoredRegistration | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredRegistration>;
    if (typeof v.token === 'string' && typeof v.userId === 'string' && typeof v.at === 'number') {
      return { token: v.token, userId: v.userId, at: v.at };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Android channels; `urgent` is the id the backend sends urgent messages to. */
export const ANDROID_CHANNELS = [
  { id: 'default', nameKey: 'push.channel.default', importance: 'default' },
  { id: 'urgent', nameKey: 'push.channel.urgent', importance: 'max' },
] as const;
