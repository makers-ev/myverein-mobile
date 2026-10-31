/** Day helpers for events that may span several days (Wave 12 M1). All days are LOCAL `YYYY-MM-DD` keys. */

export interface EventSpan {
  startsAt: string;
  endsAt: string | null;
  allDay?: boolean;
}

const MAX_DAYS = 366;

function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Every local day the event touches, first to last. All-day events end at 23:59:59 of their last day, so the
 * local date of `endsAt` is the last day; a timed event ending exactly at 00:00 does not claim the new day.
 */
export function eventDayKeys(event: EventSpan): string[] {
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) return [];
  let end = event.endsAt ? new Date(event.endsAt) : start;
  if (Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) end = start;
  const first = startOfDay(start);
  let last = startOfDay(end);
  const endsAtMidnight = end.getTime() === last.getTime();
  if (!event.allDay && endsAtMidnight && last.getTime() > first.getTime()) {
    last = new Date(last.getFullYear(), last.getMonth(), last.getDate() - 1);
  }
  const keys: string[] = [];
  for (let day = first, i = 0; day.getTime() <= last.getTime() && i < MAX_DAYS; i++) {
    keys.push(dayKey(day));
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  return keys;
}

/** The event covers more than one local day. */
export function isMultiDay(event: EventSpan): boolean {
  return eventDayKeys(event).length > 1;
}

/**
 * Human readable "when" line. Timed same-day: `18:00 – 20:00`; all-day: label (+ date range when several days);
 * timed multi-day: `Sa., 12. Mai, 18:00 – So., 13. Mai, 12:00`. All-day events never show a time of day.
 */
export function formatEventRange(event: EventSpan, language: string, allDayLabel: string): string {
  const time = { hour: '2-digit', minute: '2-digit' } as const;
  const date = { weekday: 'short', day: 'numeric', month: 'short' } as const;
  const start = new Date(event.startsAt);
  const days = eventDayKeys(event);
  if (event.allDay) {
    if (days.length <= 1) return allDayLabel;
    const [y, m, d] = days[days.length - 1].split('-').map(Number);
    return `${start.toLocaleDateString(language, date)} – ${new Date(y, m - 1, d).toLocaleDateString(language, date)}`;
  }
  const end = event.endsAt ? new Date(event.endsAt) : null;
  if (days.length > 1 && end) {
    return `${start.toLocaleString(language, { ...date, ...time })} – ${end.toLocaleString(language, { ...date, ...time })}`;
  }
  const from = start.toLocaleTimeString(language, time);
  return end ? `${from} – ${end.toLocaleTimeString(language, time)}` : from;
}

/** Request values of an all-day event: local midnight of the first day to 23:59:59 local of the last day (inclusive). */
export function allDayRange(start: Date, end: Date | null): { startsAt: string; endsAt: string } {
  const first = startOfDay(start);
  const lastDay = end && end.getTime() > first.getTime() ? end : start;
  const last = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59);
  return { startsAt: first.toISOString(), endsAt: last.toISOString() };
}
