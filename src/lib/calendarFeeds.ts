/** Calendar subscription links (Wave 12 M3). Pure helpers, the secret token never leaves component state. */

export const FEED_LABEL_MAX = 60;
export const FEED_LIMIT = 10;

export interface CalendarFeed {
  id: string;
  label: string;
  calendarId: string | null;
  calendarName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Returned only by create and rotate: the one time the secret link is visible. */
export interface NewCalendarFeed extends CalendarFeed {
  token: string;
  url: string;
  webcalUrl: string;
}

/** Body of `POST /calendar-feeds`: optional single calendar, trimmed label (empty = omitted). */
export function createFeedBody(calendarId: string | null, label: string): { calendarId: string | null; label?: string } {
  const trimmed = label.trim().slice(0, FEED_LABEL_MAX);
  return { calendarId, ...(trimmed ? { label: trimmed } : {}) };
}

/** Backend answers a bare `/feeds/...` path when it has no public base URL configured (dev only): prefix our own. */
export function absoluteFeedUrl(url: string, backendBase: string): string {
  return url.startsWith('/') ? `${backendBase.replace(/\/$/, '')}${url}` : url;
}

/** `webcal://` variant of an absolute feed URL, used when the backend sent a relative one. */
export function webcalFeedUrl(webcalUrl: string, absoluteUrl: string): string {
  return webcalUrl.startsWith('/') ? absoluteUrl.replace(/^https?:/, 'webcal:') : webcalUrl;
}
