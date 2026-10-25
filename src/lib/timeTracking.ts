import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';
import { dayKey } from './ward';

/**
 * Wave 12 M7 (P2) -- time stamp for trainers. REPORT ONLY: no payout, booking or payment state exists anywhere; amounts and
 * hourly rates are not shown in the app. Pure helpers for `/time-entries`.
 */

export type TimeEntryStatus = 'offen' | 'bestaetigt' | 'abgelehnt';

export interface TimeEntry {
  id: string;
  clubMemberId: string;
  displayName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  minutes: number | null;
  running: boolean;
  source: 'stempeln' | 'aus_termin' | 'manuell';
  status: TimeEntryStatus;
  confirmedAt: string | null;
}

export interface TimeSuggestion {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  supervisor: boolean;
}

/** "1:30 h" for 90 minutes. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

/** Whole minutes since a running entry started (never negative). */
export function elapsedMinutes(startedAt: string, now: Date): number {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / 60_000));
}

/** `YYYY-MM-DD` bounds of the month containing `now` (what `GET /time-entries?from=&to=` expects). */
export function monthBounds(now: Date): { from: string; to: string } {
  return { from: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: dayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}

export function totalMinutes(entries: readonly Pick<TimeEntry, 'minutes' | 'status'>[]): number {
  return entries.reduce((sum, e) => (e.status === 'abgelehnt' ? sum : sum + (e.minutes ?? 0)), 0);
}

/** Only an own open, finished entry can still be deleted (the server says `entry_decided` / `running` otherwise). */
export function canDeleteEntry(entry: Pick<TimeEntry, 'status' | 'running'>): boolean {
  return entry.status === 'offen' && !entry.running;
}

const DETAIL_KEYS: Record<string, string> = {
  already_running: 'time.err.running',
  none_running: 'time.err.none-running',
  entry_overlap: 'time.err.overlap',
  entry_decided: 'time.err.decided',
  running: 'time.err.running-entry',
  entry_exists: 'time.err.exists',
  in_future: 'time.err.future',
  too_long: 'time.err.too-long',
  too_old: 'time.err.too-old',
  invalid_time: 'time.err.invalid',
};

export function timeErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.details as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(DETAIL_KEYS, code)) return DETAIL_KEYS[code]!;
    if (err.status === 403) return 'time.err.not-allowed';
  }
  return apiErrorKey(err);
}
