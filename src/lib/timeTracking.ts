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
  /** Wave 16: the end was entered afterwards. */
  corrected?: boolean;
  /** Wave 16: ended by the system after the auto-close time; needs checking. */
  autoClosed?: boolean;
  /** Wave 16: ended (or rejected while running) by a board member / department lead. */
  closedByOther?: boolean;
  /** Wave 16: still running for more than 16 h (stuck). */
  overdue?: boolean;
  /** Wave 16: latest allowed end of a running entry, `min(now, start + 16 h)`. */
  maxEndedAt?: string | null;
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

/** First day of the month `delta` months away from `base` (local time). */
export function shiftMonth(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}

/** One person of `GET /time-report` (confirmed entries only). `amountCents` is `null`/absent without `time:read_rates`. */
export interface TeamHoursPerson {
  clubMemberId: string;
  displayName: string;
  entries: number;
  minutes: number;
  hours: number;
  amountCents?: number | null;
  rateMissing?: boolean;
}

export interface TeamHoursReport {
  includesRates?: boolean;
  people: TeamHoursPerson[];
  totals: { minutes: number; hours: number; amountCents?: number | null };
}

/** Cents as a localised EUR amount. */
export function formatEuro(cents: number, language: string): string {
  return (cents / 100).toLocaleString(language, { style: 'currency', currency: 'EUR' });
}

export function totalMinutes(entries: readonly Pick<TimeEntry, 'minutes' | 'status'>[]): number {
  return entries.reduce((sum, e) => (e.status === 'abgelehnt' ? sum : sum + (e.minutes ?? 0)), 0);
}

/** From this running time on the sheet asks whether the user forgot to stop (8 h). */
export const STALE_HINT_MINUTES = 8 * 60;
/** The server refuses to stop an entry running longer than this (16 h, `too_long`): it can only be discarded for now. */
export const MAX_ENTRY_MINUTES = 16 * 60;

export type RunningState = 'ok' | 'stale' | 'too-long';

/** How a running entry should be presented: normal, "did you forget to stop?" (>= 8 h) or no longer stoppable (> 16 h). */
export function runningState(minutes: number): RunningState {
  if (minutes > MAX_ENTRY_MINUTES) return 'too-long';
  if (minutes >= STALE_HINT_MINUTES) return 'stale';
  return 'ok';
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
  needs_end_time: 'time.err.needs-end',
  too_old: 'time.err.too-old',
  invalid_time: 'time.err.invalid',
  no_rate: 'time.err.no-rate',
  report_too_large: 'time.err.report-too-large',
};

/** The entry is stuck: server flag, or (older backends) running for more than 16 h. */
export function isStuck(e: Pick<TimeEntry, 'running' | 'overdue' | 'startedAt'>, now: Date): boolean {
  return e.running && (e.overdue ?? runningState(elapsedMinutes(e.startedAt, now)) === 'too-long');
}

/** Latest end a running entry may get (ms): the server value, else min(now, start + 16 h). */
export function latestEnd(e: Pick<TimeEntry, 'startedAt' | 'maxEndedAt'>, now: Date): number {
  if (e.maxEndedAt) {
    const max = new Date(e.maxEndedAt).getTime();
    if (!Number.isNaN(max)) return max;
  }
  return Math.min(now.getTime(), new Date(e.startedAt).getTime() + MAX_ENTRY_MINUTES * 60_000);
}

export type EndProblem = 'order' | 'future' | 'long';

/** Client mirror of the end-time rules (start < end <= min(now, start + 16 h)); the server decides. */
export function endTimeProblem(e: Pick<TimeEntry, 'startedAt' | 'maxEndedAt'>, end: Date, now: Date): EndProblem | null {
  const start = new Date(e.startedAt).getTime();
  const t = end.getTime();
  if (Number.isNaN(t) || t <= start) return 'order';
  if (t > start + MAX_ENTRY_MINUTES * 60_000) return 'long';
  if (t > latestEnd(e, now) + 60_000) return 'future';
  return null;
}

export const END_PROBLEM_KEY: Record<EndProblem, string> = {
  order: 'time.err.invalid',
  future: 'time.err.future',
  long: 'time.err.end-too-long',
};

/** Pills next to an entry: how its end came about. */
export function entryMarks(
  e: Pick<TimeEntry, 'corrected' | 'autoClosed' | 'closedByOther'> & { status?: TimeEntryStatus },
): ('autoClosed' | 'autoDiscarded' | 'closedByOther' | 'corrected')[] {
  const marks: ('autoClosed' | 'autoDiscarded' | 'closedByOther' | 'corrected')[] = [];
  // A stamp that ran for over a year is rejected by the system (`abgelehnt` + `autoClosed`): "verworfen", not "bitte prüfen".
  if (e.autoClosed) marks.push(e.status === 'abgelehnt' ? 'autoDiscarded' : 'autoClosed');
  if (e.closedByOther) marks.push('closedByOther');
  else if (e.corrected && !e.autoClosed) marks.push('corrected');
  return marks;
}

/** `needs_end_time` on clock-out: the entry runs too long and needs an end time. */
export function needsEndTime(err: unknown): boolean {
  return err instanceof ApiError && (err.details as { code?: unknown } | undefined)?.code === 'needs_end_time';
}

/** Text key for a failed "set the end" request; `too_long` here means the chosen end, not the running time. */
export function endTimeErrorKey(err: unknown): string {
  if (err instanceof ApiError && (err.details as { code?: unknown } | undefined)?.code === 'too_long') return 'time.err.end-too-long';
  return timeErrorKey(err);
}

export function timeErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.details as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(DETAIL_KEYS, code)) return DETAIL_KEYS[code]!;
    if (err.status === 403) return 'time.err.not-allowed';
  }
  return apiErrorKey(err);
}
