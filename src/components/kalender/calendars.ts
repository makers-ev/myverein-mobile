import type { Calendar } from '@/hooks/useCalendars';

/** The default calendar is the only one: the backend forbids deleting it or scoping it to a department. */
export function isLockedDefaultCalendar(calendar: Calendar, calendars: readonly Calendar[]): boolean {
  return calendar.isDefault && calendars.length <= 1;
}

/** Calendar preselected for a new event: the club default, else the first one, else null. */
export function defaultCalendarId(calendars: readonly Calendar[]): string | null {
  return (calendars.find((c) => c.isDefault) ?? calendars[0])?.id ?? null;
}
