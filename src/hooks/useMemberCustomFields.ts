import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { isNoFieldsError, type MemberCustomField } from '@/lib/customFields';

export type CustomFieldsStatus = 'loading' | 'ready' | 'failed' | 'hidden';

interface FieldsResponse {
  data: { fields: MemberCustomField[] };
}

/**
 * Custom fields of one member (Wave 8 M4): `target` is `'me'` (the caller's own record, `GET/PATCH /club-members/me/custom-fields`)
 * or a `club_members.id` (read-only in the app, `GET /club-members/:id/custom-fields`). The server decides what is visible and
 * editable. Race-safe: the data is kept together with its club and target, every load takes a sequence number and only the
 * newest may write state (a late answer for another club/member is dropped, so values of one person never show up on
 * another's sheet); unmounting drops everything. Nothing is cached or persisted -- values only live in this hook's state.
 * `hidden` = no custom fields for this person (guest, record not readable): nothing to show, no error.
 */
export function useMemberCustomFields(clubId: string | null, target: string | null) {
  const [stored, setStored] = useState<{ key: string; fields: MemberCustomField[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; hidden: boolean } | null>(null);
  const [loading, setLoading] = useState(!!clubId && !!target);
  const seq = useRef(0);
  const key = clubId && target ? `${clubId}|${target}` : null;
  const path = clubId && target ? `/club-members/${encodeURIComponent(target)}/custom-fields?clubId=${encodeURIComponent(clubId)}` : null;

  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!path || !key) {
      setLoading(false);
      return;
    }
    // Another club/member: drop what belongs to the previous one right away (personal data must not linger in memory).
    setStored((cur) => (cur && cur.key !== key ? null : cur));
    setFailure((cur) => (cur && cur.key !== key ? null : cur));
    setLoading(true);
    try {
      const res = await apiFetch<FieldsResponse>(path);
      if (id !== seq.current) return;
      setStored({ key, fields: res.data.fields });
      setFailure(null);
    } catch (err) {
      if (id !== seq.current) return;
      setFailure({ key, hidden: isNoFieldsError(err) });
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path, key]);

  useEffect(() => {
    // Drops the pending load of the previous club/target on switch and on unmount.
    void reload();
    const current = seq;
    return () => {
      current.current++;
    };
  }, [reload]);

  /**
   * Own values only (`PATCH`), the body holds just the changed editable keys (`null` removes a value). Resolves with the fresh
   * view the server returns; rejects with the `ApiError` (`422 details.fields` per key). A late answer after a club/member
   * switch is dropped.
   */
  const save = useCallback(
    async (values: Record<string, unknown>): Promise<MemberCustomField[] | null> => {
      if (!path || !key || target !== 'me') throw new Error('not editable');
      const ticket = ++seq.current;
      let res: FieldsResponse;
      try {
        res = await apiFetch<FieldsResponse>(path, { method: 'PATCH', body: { values } });
      } catch (err) {
        if (ticket === seq.current) setLoading(false);
        throw err;
      }
      if (ticket !== seq.current) return null;
      setStored({ key, fields: res.data.fields });
      setFailure(null);
      // The write superseded a reload that may still be in flight (its answer is dropped): never leave `loading` stuck.
      setLoading(false);
      return res.data.fields;
    },
    [path, key, target],
  );

  const fields = stored && stored.key === key ? stored.fields : null;
  const failed = failure && failure.key === key ? failure : null;
  const status: CustomFieldsStatus = fields ? 'ready' : failed ? (failed.hidden ? 'hidden' : 'failed') : 'loading';
  return { fields, status, loading, reload, save };
}
