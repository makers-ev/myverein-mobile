import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { type DecidedApplication, type OpenApplication, selectApplicationStatus } from '@/lib/applicationStatus';
import { formErrorKey, type MySubmission } from '@/lib/formSchema';

export type MyApplicationsPhase = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The applicant's own applications across all clubs (`GET /form-submissions/mine`): open ones (draft / submitted) to
 * continue and recently decided ones (accepted / rejected with the board's message / withdrawn). Race-safe: each load takes a
 * sequence number and only the newest may write state; unmounting or `enabled` turning false drops everything in flight.
 * A reload keeps the previous list on screen. Nothing is persisted.
 */
export function useMyApplications(enabled: boolean) {
  const [open, setOpen] = useState<OpenApplication[]>([]);
  const [decided, setDecided] = useState<DecidedApplication[]>([]);
  const [phase, setPhase] = useState<MyApplicationsPhase>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setPhase((p) => (p === 'ready' ? p : 'loading'));
    setErrorKey(null);
    try {
      const res = await apiFetch<{ data: MySubmission[] }>('/form-submissions/mine');
      if (id !== requestId.current) return;
      const next = selectApplicationStatus(res.data);
      setOpen(next.open);
      setDecided(next.decided);
      setPhase('ready');
    } catch (err) {
      if (id !== requestId.current) return;
      setErrorKey(formErrorKey(err));
      setPhase((p) => (p === 'ready' ? p : 'error'));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const seq = requestId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount/sign-in; stale answers are dropped by the request id
    void load();
    return () => {
      // Signing out or unmounting: whatever is still in flight must not write state.
      seq.current++;
    };
  }, [enabled, load]);

  // Disabled (guest / signed out): nothing is shown, and a previous user's list is never exposed.
  if (!enabled) return { open: [], decided: [], phase: 'idle' as MyApplicationsPhase, errorKey: null, reload: load };
  return { open, decided, phase, errorKey, reload: load };
}
