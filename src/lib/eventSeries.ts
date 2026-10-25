import { allDayRange } from './eventDays';

/** Recurring events (Wave 12 M2): rule draft, request bodies and scope helpers. Pure, no React. */

export type SeriesFreq = 'daily' | 'weekly' | 'monthly';
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type SeriesScope = 'this' | 'this_and_following' | 'all';
export type SetPos = 1 | 2 | 3 | 4 | -1;

export const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const SERIES_REASON_MAX = 500;
export const MAX_COUNT = 1000;

/** `event_series` row as returned by the backend (camelCase). */
export interface EventSeries {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  category: string | null;
  capacity: number | null;
  locationId: string | null;
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  durationMinutes: number | null;
  durationDays: number;
  timezone: string;
  freq: SeriesFreq;
  intervalCount: number;
  byDay: Weekday[] | null;
  bySetPos: SetPos | null;
  untilDate: string | null;
  count: number | null;
  skipHolidays: boolean;
}

export type RecurrenceEnd = 'never' | 'until' | 'count';

/** Editor state of the repeat section. `freq: null` = does not repeat. */
export interface RecurrenceDraft {
  freq: SeriesFreq | null;
  interval: string;
  byDay: Weekday[];
  /** Monthly: same day of the month vs. "n-th weekday". */
  monthlyMode: 'day' | 'nth';
  bySetPos: SetPos;
  end: RecurrenceEnd;
  untilDate: Date | null;
  count: string;
  skipHolidays: boolean;
}

/** Weekday of a local date in the backend's two-letter form. */
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

/** The "n-th weekday of the month" position of a date (5th occurrence counts as "last"). */
export function setPosOf(date: Date): SetPos {
  const n = Math.ceil(date.getDate() / 7);
  return n > 4 ? -1 : (n as SetPos);
}

export function defaultRecurrence(start: Date | null): RecurrenceDraft {
  const base = start ?? new Date();
  return {
    freq: null,
    interval: '1',
    byDay: [weekdayOf(base)],
    monthlyMode: 'day',
    bySetPos: setPosOf(base),
    end: 'never',
    untilDate: null,
    count: '10',
    skipHolidays: false,
  };
}

function ymd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Prefills the editor from a stored series (edit with scope "all" / "this and following"). */
export function draftFromSeries(series: EventSeries): RecurrenceDraft {
  const start = ymd(series.startDate);
  return {
    freq: series.freq,
    interval: String(series.intervalCount),
    byDay: series.byDay && series.byDay.length > 0 ? series.byDay : [weekdayOf(start)],
    monthlyMode: series.freq === 'monthly' && series.bySetPos != null ? 'nth' : 'day',
    bySetPos: series.bySetPos ?? setPosOf(start),
    end: series.untilDate ? 'until' : series.count != null ? 'count' : 'never',
    untilDate: series.untilDate ? ymd(series.untilDate) : null,
    count: series.count != null ? String(series.count) : '10',
    skipHolidays: series.skipHolidays,
  };
}

/** Translation key of the first problem of a repeat draft, or null when it is valid. */
export function recurrenceProblem(draft: RecurrenceDraft, start: Date | null): string | null {
  if (!draft.freq) return null;
  const interval = Number(draft.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 99) return 'series.error.interval';
  if (draft.freq === 'weekly' && draft.byDay.length === 0) return 'series.error.weekdays';
  if (draft.end === 'until') {
    if (!draft.untilDate) return 'series.error.until-missing';
    if (start && draft.untilDate.getTime() < new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) return 'series.error.until-before-start';
  }
  if (draft.end === 'count') {
    const count = Number(draft.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) return 'series.error.count';
  }
  return null;
}

export function toYmd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function toHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Event template shared by create and edit (the sheet's form state). */
export interface SeriesTemplate {
  calendarId: string;
  title: string;
  description: string | null;
  category: string | null;
  capacity: number | null;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date | null;
}

/** Duration fields derived from the form's start/end. */
function durationFields(t: SeriesTemplate): { durationMinutes?: number; durationDays?: number } {
  if (t.allDay) {
    const first = new Date(t.startsAt.getFullYear(), t.startsAt.getMonth(), t.startsAt.getDate());
    const last = t.endsAt ? new Date(t.endsAt.getFullYear(), t.endsAt.getMonth(), t.endsAt.getDate()) : first;
    const days = Math.round((last.getTime() - first.getTime()) / 86400000) + 1;
    return { durationDays: Math.min(366, Math.max(1, days)) };
  }
  if (!t.endsAt) return {};
  const minutes = Math.round((t.endsAt.getTime() - t.startsAt.getTime()) / 60000);
  return minutes > 0 ? { durationMinutes: minutes } : {};
}

/** Rule fields of a draft; `clearing` sends explicit nulls so an edit can drop an end/weekday rule. */
function ruleFields(draft: RecurrenceDraft, start: Date, clearing: boolean) {
  const freq = draft.freq as SeriesFreq;
  const out: Record<string, unknown> = { freq, interval: Number(draft.interval), skipHolidays: draft.skipHolidays };
  const nth = freq === 'monthly' && draft.monthlyMode === 'nth';
  if (freq === 'weekly') out.byDay = WEEKDAYS.filter((d) => draft.byDay.includes(d));
  else if (nth) out.byDay = [weekdayOf(start)];
  else if (clearing) out.byDay = null;
  if (nth) out.bySetPos = draft.bySetPos;
  else if (clearing) out.bySetPos = null;
  if (draft.end === 'until' && draft.untilDate) out.untilDate = toYmd(draft.untilDate);
  else if (clearing) out.untilDate = null;
  if (draft.end === 'count') out.count = Number(draft.count);
  else if (clearing) out.count = null;
  return out;
}

function omitNull<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

/** Body of `POST /event-series` and `POST /event-series/preview`. */
export function createSeriesBody(template: SeriesTemplate, draft: RecurrenceDraft): Record<string, unknown> {
  return omitNull({
    calendarId: template.calendarId,
    title: template.title,
    description: template.description,
    category: template.category,
    capacity: template.capacity,
    allDay: template.allDay,
    startDate: toYmd(template.startsAt),
    startTime: template.allDay ? null : toHm(template.startsAt),
    ...durationFields(template),
    ...ruleFields(draft, template.startsAt, false),
  });
}

/** Optional trailing fields of an edit/delete request. */
export interface SeriesRequestOptions {
  reason?: string;
  notify?: boolean;
}

function trimmedReason(reason: string | undefined): string | undefined {
  const trimmed = (reason ?? '').trim().slice(0, SERIES_REASON_MAX);
  return trimmed || undefined;
}

/**
 * Body of `PATCH /event-series/:id`. Scope `this` changes the single occurrence (absolute start/end); the other
 * scopes change the template, time of day, duration and (with a draft) the rule for the future.
 */
export function patchSeriesBody(
  scope: SeriesScope,
  eventId: string,
  template: SeriesTemplate,
  draft: RecurrenceDraft | null,
  options: SeriesRequestOptions = {},
): Record<string, unknown> {
  const common = { scope, ...(scope === 'all' ? {} : { eventId }), ...(trimmedReason(options.reason) ? { reason: trimmedReason(options.reason) } : {}), ...(options.notify === false ? { notify: false } : {}) };
  const base = {
    title: template.title,
    description: template.description,
    category: template.category,
    capacity: template.capacity,
    allDay: template.allDay,
  };
  if (scope === 'this') {
    const range = template.allDay
      ? allDayRange(template.startsAt, template.endsAt)
      : { startsAt: template.startsAt.toISOString(), endsAt: template.endsAt ? template.endsAt.toISOString() : null };
    return { ...common, ...base, ...range };
  }
  const rule = draft && draft.freq ? ruleFields(draft, template.startsAt, true) : {};
  return {
    ...common,
    ...base,
    startTime: template.allDay ? null : toHm(template.startsAt),
    ...(template.allDay ? { durationDays: durationFields(template).durationDays } : { durationMinutes: durationFields(template).durationMinutes ?? null }),
    ...rule,
  };
}

/** Query string of `DELETE /event-series/:id`. */
export function deleteSeriesQuery(clubId: string, scope: SeriesScope, eventId: string, options: SeriesRequestOptions = {}): string {
  const params = new URLSearchParams({ clubId, scope });
  if (scope !== 'all') params.set('eventId', eventId);
  const reason = trimmedReason(options.reason);
  if (reason) params.set('reason', reason);
  if (options.notify === false) params.set('notify', 'false');
  return params.toString();
}

export interface SeriesPreview {
  occurrences: { startsAt: string; endsAt: string | null; localDate: string }[];
  skippedHolidays: { localDate: string; holiday: string }[];
  finished: boolean;
}

/** Sign-ups an edit/delete of an occurrence would touch (warning before the scope dialog). */
export function affectedSignups(event: { attendeeCount?: number; waitlistCount?: number }): number {
  return (event.attendeeCount ?? 0) + (event.waitlistCount ?? 0);
}
