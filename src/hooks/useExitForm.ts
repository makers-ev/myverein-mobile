import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { FormDefinition } from '@/lib/formSchema';

/**
 * The club's published exit form (`GET /club-exit-requests/form`, applicant view), loaded while `enabled` (the cancellation
 * sheet is open) and again whenever `reload` is called. Race-safe like the other hooks: data belongs to its club, only the
 * newest load may write state, unmounting or closing drops pending answers. `replace` takes over the newer definition a
 * `409 FORM_VERSION_OUTDATED` delivered. Nothing is persisted; the definition holds no personal data.
 */
export function useExitForm(clubId: string | null, enabled: boolean) {
  const [stored, setStored] = useState<{ clubId: string; definition: FormDefinition } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!clubId || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch<{ data: FormDefinition }>(`/club-exit-requests/form?clubId=${encodeURIComponent(clubId)}`);
      if (id === seq.current) setStored({ clubId, definition: res.data });
    } catch {
      if (id === seq.current) setError(true);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [clubId, enabled]);

  useEffect(() => {
    void reload();
    const current = seq;
    return () => {
      current.current++;
    };
  }, [reload]);

  const replace = useCallback(
    (definition: FormDefinition) => {
      if (clubId) setStored({ clubId, definition });
    },
    [clubId],
  );

  const definition = enabled && stored && stored.clubId === clubId ? stored.definition : null;
  return { definition, loading, error, reload, replace };
}
