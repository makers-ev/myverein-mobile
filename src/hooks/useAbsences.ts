import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import { dayKey } from '@/lib/ward';
import { useScopedResource } from './useScopedResource';

export type AbsenceKind = 'krank' | 'abwesend';

/** One absence report (`shapeAbsence` in the backend). `note` is the short free text; it is never logged or put in a push. */
export interface Absence {
  id: string;
  clubMemberId: string;
  kind: AbsenceKind;
  startsOn: string;
  endsOn: string;
  note: string | null;
  reportedByKind: 'self' | 'guardian';
  withdrawnAt: string | null;
}

export interface AbsenceInput {
  kind: AbsenceKind;
  startsOn: string;
  endsOn: string;
  note: string | null;
}

/** Whose absences: the caller's own, or a ward's (guardian with `can_report_absence`). */
export type AbsenceSubject = { kind: 'self'; clubId: string } | { kind: 'ward'; clubId: string; wardId: string };

function basePath(subject: AbsenceSubject | null): string | null {
  if (!subject) return null;
  const q = `clubId=${encodeURIComponent(subject.clubId)}`;
  const base = subject.kind === 'self' ? '/absences' : `/guardian/wards/${encodeURIComponent(subject.wardId)}/absences`;
  return `${base}?${q}`;
}

/** `/absences?clubId=x` + id -> `/absences/<id>?clubId=x` (same for the ward variant). */
function itemPath(list: string, id: string): string {
  const [base, query] = list.split('?');
  return `${base}/${encodeURIComponent(id)}?${query}`;
}

/**
 * Upcoming (not yet ended, not withdrawn) absences of one subject with create and withdraw. The backend answers 403/404
 * for somebody who may not report (external guest, expired link): the error is exposed so the section can hide itself.
 */
export function useAbsences(subject: AbsenceSubject | null) {
  const list = basePath(subject);
  const { data, loading, error, reload, mutate } = useScopedResource<Absence[]>(list);

  const create = useCallback(
    async (input: AbsenceInput): Promise<{ ok: true } | { ok: false; error: unknown }> => {
      if (!list) return { ok: false, error: null };
      try {
        await apiFetch(list, { method: 'POST', body: input });
        void reload();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err };
      }
    },
    [list, reload],
  );

  /** Withdraw is idempotent on the server; the row disappears at once and comes back through the reload on failure. */
  const withdraw = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: unknown }> => {
      if (!list) return { ok: false, error: null };
      mutate((rows) => rows.filter((a) => a.id !== id));
      try {
        await apiFetch(itemPath(list, id), { method: 'DELETE' });
        return { ok: true };
      } catch (err) {
        void reload();
        return { ok: false, error: err };
      }
    },
    [list, mutate, reload],
  );

  return { absences: data ?? [], loading, error, reload, create, withdraw };
}

export interface ClubAbsence extends Absence {
  displayName: string | null;
}

/** "Wer fehlt heute" for `absences:read` holders: today's reports in the caller's scope (trainers: own departments only). */
export function useClubAbsencesToday(clubId: string | null, enabled: boolean) {
  const today = dayKey(new Date());
  const path = enabled && clubId ? `/absences/club?clubId=${encodeURIComponent(clubId)}&from=${today}&to=${today}` : null;
  const { data, loading, error, reload } = useScopedResource<ClubAbsence[]>(path);
  return { absences: data ?? [], loading, error, reload };
}
