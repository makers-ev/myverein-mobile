import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';

/** One child the account is guardian of, flattened from `GET /my-wards` (grouped by club there). */
export interface Ward {
  clubId: string;
  clubName: string;
  wardId: string;
  name: string;
  firstName: string | null;
  relationship: string | null;
  canConsent: boolean;
  canReportAbsence: boolean;
  hasCustody: boolean;
  validUntil: string | null;
  openConsents: number;
}

export interface MyWardsGroup {
  clubId: string;
  clubName: string;
  wards: Omit<Ward, 'clubId' | 'clubName'>[];
}

/** Flattens the per-club groups; a malformed answer yields no wards (deny by default). */
export function flattenWards(groups: unknown): Ward[] {
  if (!Array.isArray(groups)) return [];
  const out: Ward[] = [];
  for (const g of groups as MyWardsGroup[]) {
    if (!g || typeof g.clubId !== 'string' || !Array.isArray(g.wards)) continue;
    for (const w of g.wards) {
      if (!w || typeof w.wardId !== 'string') continue;
      out.push({ ...w, clubId: g.clubId, clubName: g.clubName ?? '', name: w.name ?? w.firstName ?? '' });
    }
  }
  return out;
}

/** Stable identity of a ward across clubs (a ward id is only unique within its club's scope on the wire). */
export const wardKey = (w: Pick<Ward, 'clubId' | 'wardId'>): string => `${w.clubId}:${w.wardId}`;

/** Local calendar day as `YYYY-MM-DD` (what the backend's `date` params expect). */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysKey(d: Date, days: number): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return dayKey(next);
}

/** `YYYY-MM-DD` -> local-midnight Date. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d);
}

/**
 * A club the account belongs to itself. `/my-clubs` also lists the guest membership a guardian gets in their child's
 * club (`orgRole` 'guest', possibly comma-separated); that is no club of their own.
 */
export function isOwnClub(club: { orgRole?: string | null }): boolean {
  const roles = (club.orgRole ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  return roles.length === 0 || roles.some((r) => r !== 'guest');
}

export const isNotFound = (err: unknown): boolean => err instanceof ApiError && err.status === 404;

/**
 * Translation key for a failed Wave 10 call. The machine-readable `details.code` wins over the generic status text;
 * `null` = no specific key, the caller falls back to `apiErrorMessage`. Never reads or echoes user text.
 */
export function privacyErrorKey(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const code = (err.details as { code?: unknown } | undefined)?.code;
  switch (code) {
    case 'invalid_period':
      return 'absence.error.invalid-period';
    case 'period_too_old':
      return 'absence.error.too-old';
    case 'period_too_long':
      return 'absence.error.too-long';
    case 'guardian_cannot_report_absence':
      return 'absence.error.no-right';
    case 'consent_requires_guardian':
      return 'consent.error.requires-guardian';
    case 'guardian_cannot_consent':
    case 'consent_not_for_guardian':
      return 'consent.error.guardian-no-right';
    case 'consent_not_available':
      return 'consent.error.not-available';
    case 'ward_has_account':
      return 'heute.error.ward-has-account';
    default:
      return null;
  }
}

/**
 * Key for a failed Wave 10 call: the specific `details.code` text, else the status-based text (DPA_REQUIRED, 403, 429,
 * 5xx, ...) of `apiErrorKey`, else `fallbackKey`.
 */
export function privacyErrorKeyOr(err: unknown, fallbackKey: string): string {
  return privacyErrorKey(err) ?? apiErrorKey(err, fallbackKey);
}

/** `consent_text_outdated` (409): the text was replaced while the sheet was open. */
export function isConsentTextOutdated(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const code = (err.details as { code?: unknown } | undefined)?.code;
  return code === 'consent_text_outdated';
}

export type NavRoute = 'Home' | 'Heute' | 'Verein' | 'Kalender' | 'Standorte' | 'Mitteilungen' | 'Notifications' | 'Settings';

const CLUB_ONLY_ROUTES: readonly NavRoute[] = ['Home', 'Verein', 'Kalender', 'Standorte', 'Mitteilungen'];

/**
 * Which Navbar entries show. `Heute` only for accounts with wards; a guardian-only account (no club membership) gets no
 * club entries at all (nothing to show there), just Heute, notices and settings. Guests and everyone else: unchanged.
 */
export function visibleNavRoutes(routes: readonly NavRoute[], flags: { hasWards: boolean; guardianOnly: boolean }): NavRoute[] {
  return routes.filter((r) => {
    if (r === 'Heute') return flags.hasWards;
    if (flags.guardianOnly && CLUB_ONLY_ROUTES.includes(r)) return false;
    return true;
  });
}

export const ABSENCE_NOTE_MAX = 200;

/** Client-side mirror of the backend period check (end not before start); the server stays authoritative. */
export function absencePeriodError(startsOn: string, endsOn: string): 'invalid_period' | null {
  return endsOn < startsOn ? 'invalid_period' : null;
}

/** Items grouped by the local day of `startsAt`, keeping the given order. */
export function groupByDay<T extends { startsAt: string }>(items: T[]): { day: string; events: T[] }[] {
  const groups: { day: string; events: T[] }[] = [];
  for (const e of items) {
    const day = dayKey(new Date(e.startsAt));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.events.push(e);
    else groups.push({ day, events: [e] });
  }
  return groups;
}

/** Strips everything but digits and a leading plus, so the dialer gets a clean `tel:` target. */
export const telUrl = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
