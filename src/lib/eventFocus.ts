/** Pure helpers for opening an event from a push tap in the month-based Termine tab. */

/** The event for an open sheet: the month list wins, the event fetched for the tap covers a miss (e.g. outside the loaded range). */
export function resolveSheetEvent<T extends { id: string }>(events: T[], eventId: string, fetched: T | null): T | null {
  return events.find((e) => e.id === eventId) ?? (fetched && fetched.id === eventId ? fetched : null);
}

/** The sheet points at an event that is neither listed nor fetched once loading is done -> close it and tell the user. */
export function isSheetEventMissing(state: { eventId: string | null; loading: boolean; resolved: unknown }): boolean {
  return !!state.eventId && !state.loading && !state.resolved;
}
