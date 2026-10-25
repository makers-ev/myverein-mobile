/**
 * Wave 12 M4 -- attendance list at the pitch. Pure helpers: types of `GET /events/:id/attendance`, optimistic local
 * changes, the buffer that is re-sent after a short network break and the batch body of `PUT`. The absence reason of a
 * prefilled "entschuldigt" never exists in the payload (privacy), and names are never logged.
 */

export const ATTENDANCE_STATUSES = ['anwesend', 'entschuldigt', 'unentschuldigt'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_REASON_MAX = 300;

export interface AttendanceEntry {
  /** `m:<clubMemberId>` or `g:<attendanceId>`. */
  key: string;
  attendanceId: string | null;
  clubMemberId: string | null;
  guestName: string | null;
  displayName: string;
  /** `null` = still open. */
  status: AttendanceStatus | null;
  source: 'manuell' | 'meldung' | null;
  /** Derived from an absence report (Wave 10), not stored yet. */
  prefilled: boolean;
  rsvp: 'angemeldet' | 'warteliste' | null;
  onRoster: boolean;
  isMinor: boolean;
  hasAccount: boolean;
}

export interface AttendanceSummary {
  anwesend: number;
  entschuldigt: number;
  unentschuldigt: number;
  offen: number;
}

export interface AttendanceCorrection {
  displayName: string | null;
  oldStatus: AttendanceStatus | null;
  newStatus: AttendanceStatus | null;
  reason: string;
  changedAt: string;
}

export interface AttendanceView {
  eventId: string;
  tracking: boolean;
  closed: boolean;
  closedAt: string | null;
  canWrite: boolean;
  supervisors: { clubMemberId: string; displayName: string }[];
  entries: AttendanceEntry[];
  summary: AttendanceSummary;
  supervisionWarning: boolean;
  minorsPresent: number;
  corrections: AttendanceCorrection[];
}

/** Buffered, not yet confirmed changes by entry key (`null` = back to open / remove a guest). */
export type PendingChanges = ReadonlyMap<string, AttendanceStatus | null>;

export function summarize(entries: readonly AttendanceEntry[]): AttendanceSummary {
  const out: AttendanceSummary = { anwesend: 0, entschuldigt: 0, unentschuldigt: 0, offen: 0 };
  for (const e of entries) {
    if (e.status) out[e.status] += 1;
    else out.offen += 1;
  }
  return out;
}

/** Tapping the status that is already set clears it again (back to open). */
export function toggleStatus(current: AttendanceStatus | null, target: AttendanceStatus): AttendanceStatus | null {
  return current === target ? null : target;
}

/** Local result of one change; a guest set back to open disappears from the list (the server removes the row). */
export function applyChange(view: AttendanceView, key: string, status: AttendanceStatus | null): AttendanceView {
  const entries: AttendanceEntry[] = [];
  for (const e of view.entries) {
    if (e.key !== key) {
      entries.push(e);
      continue;
    }
    if (status === null && !e.clubMemberId) continue;
    entries.push({ ...e, status, source: status ? 'manuell' : null, prefilled: false });
  }
  return { ...view, entries, summary: summarize(entries) };
}

/** Server view with the still-unconfirmed local changes laid over it (a response must not undo later taps). */
export function applyPending(view: AttendanceView, pending: PendingChanges): AttendanceView {
  let next = view;
  for (const [key, status] of pending) {
    if (next.entries.some((e) => e.key === key)) next = applyChange(next, key, status);
  }
  return next;
}

/** Changes for "Alle anwesend": only people who are still open, never overriding an excused / absent entry. */
export function markAllPresentChanges(view: AttendanceView): { key: string; status: AttendanceStatus }[] {
  return view.entries.filter((e) => e.status === null).map((e) => ({ key: e.key, status: 'anwesend' as const }));
}

export interface AttendanceItemBody {
  clubMemberId?: string;
  attendanceId?: string;
  status: AttendanceStatus | null;
}

/** `m:<id>` -> clubMemberId, `g:<id>` -> attendanceId; anything else is not sent. */
export function itemForKey(key: string, status: AttendanceStatus | null): AttendanceItemBody | null {
  if (key.startsWith('m:') && key.length > 2) return { clubMemberId: key.slice(2), status };
  if (key.startsWith('g:') && key.length > 2) return { attendanceId: key.slice(2), status };
  return null;
}

/** Body of the one batch `PUT /events/:id/attendance`; `reason` only once the list is closed. */
export function buildPutBody(
  pending: PendingChanges,
  reason: string | null,
): { entries: AttendanceItemBody[]; reason?: string } | null {
  const entries: AttendanceItemBody[] = [];
  for (const [key, status] of pending) {
    const item = itemForKey(key, status);
    if (item) entries.push(item);
  }
  if (entries.length === 0) return null;
  const trimmed = reason?.trim().slice(0, ATTENDANCE_REASON_MAX);
  return { entries: entries.slice(0, 500), ...(trimmed ? { reason: trimmed } : {}) };
}

/** A short network break (or a server hiccup) is worth another try; a rejected request is not. */
export function isRetryableStatus(status: number | null): boolean {
  return status === null || status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Retry delay for the buffered changes: 3 s, doubling, at most 30 s. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 3_000 * 2 ** Math.max(0, attempt));
}

/** Entries of people (not guests) that can be chosen as supervisors. */
export function supervisorCandidates(view: AttendanceView): { clubMemberId: string; displayName: string }[] {
  return view.entries
    .filter((e) => e.clubMemberId && !e.isMinor)
    .map((e) => ({ clubMemberId: e.clubMemberId as string, displayName: e.displayName }));
}

export function toggleSupervisor(current: readonly string[], clubMemberId: string): string[] {
  return current.includes(clubMemberId) ? current.filter((id) => id !== clubMemberId) : [...current, clubMemberId].slice(0, 20);
}

export const GUEST_NAME_MAX = 100;

export function cleanGuestName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, GUEST_NAME_MAX);
  return name.length > 0 ? name : null;
}
