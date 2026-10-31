import type { AttendanceEntry, AttendanceRow } from '@/hooks/useMeetingDetail';

/** What a member's row looks like without a stored row (DB defaults: not present, voting right, no proxy). */
export const ATTENDANCE_DEFAULTS = { present: false, hasVotingRight: true, proxyForMemberId: null as string | null };

export type AttendanceEdit = Partial<{ present: boolean; hasVotingRight: boolean; proxyForMemberId: string | null }>;
export type AttendanceEdits = Record<string, AttendanceEdit>;

/** Stored value of one member (or the defaults). */
export function storedAttendance(rows: readonly AttendanceRow[], memberId: string): typeof ATTENDANCE_DEFAULTS {
  const row = rows.find((r) => r.memberId === memberId);
  return row
    ? { present: row.present, hasVotingRight: row.hasVotingRight, proxyForMemberId: row.proxyForMemberId ?? null }
    : { ...ATTENDANCE_DEFAULTS };
}

/** Value shown in the form: the pending edit wins over the stored value. */
export function effectiveAttendance(rows: readonly AttendanceRow[], edits: AttendanceEdits, memberId: string): typeof ATTENDANCE_DEFAULTS {
  return { ...storedAttendance(rows, memberId), ...(edits[memberId] ?? {}) };
}

/** Applies one field edit; an edit equal to the stored value is dropped, so unchanged rows are never sent. */
export function applyAttendanceEdit<K extends keyof AttendanceEdit>(
  rows: readonly AttendanceRow[],
  edits: AttendanceEdits,
  memberId: string,
  field: K,
  value: NonNullable<AttendanceEdit[K]> | null,
): AttendanceEdits {
  const stored = storedAttendance(rows, memberId);
  const next: AttendanceEdit = { ...(edits[memberId] ?? {}) };
  if (stored[field] === value) delete next[field];
  else (next as Record<string, unknown>)[field] = value;
  const rest = { ...edits };
  if (Object.keys(next).length === 0) delete rest[memberId];
  else rest[memberId] = next;
  return rest;
}

/**
 * Body of the partial-update `PATCH /meetings/:id/attendance` (B17): one entry per edited member, containing only
 * the edited fields. Members without edits are not listed, so re-saving can never reset stored values.
 */
export function buildAttendanceEntries(edits: AttendanceEdits): AttendanceEntry[] {
  return Object.entries(edits)
    .filter(([, edit]) => Object.keys(edit).length > 0)
    .map(([memberId, edit]) => ({ memberId, ...edit }));
}
