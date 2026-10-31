import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { isJobRunning, type GenerationJob, type GenerationTemplate } from '@/lib/documents';
import { pollJob } from '@/lib/jobPolling';
import { useScopedResource } from './useScopedResource';

/**
 * Templates the caller may request (`GET /document-generation/templates`, filtered by the backend per permission).
 * A 403 (external guests) or any failure yields `null`: nothing is offered (deny by default).
 */
export function useGenerationTemplates(clubId: string | null) {
  const { data, loading } = useScopedResource<GenerationTemplate[]>(clubId ? `/document-generation/templates?clubId=${encodeURIComponent(clubId)}` : null);
  const can = useCallback((templateId: string) => !!data?.some((t) => t.id === templateId), [data]);
  return { templates: data, loading, can };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function newIdempotencyKey(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type GenerationOutcome = { ok: true; job: GenerationJob } | { ok: false; error: unknown; job: GenerationJob | null };

/**
 * Requests a PDF (`POST /document-generation`) and follows the job until it is finished. One request at a time (a second
 * tap while working is ignored); closing the screen stops polling. The outcome carries the raw failure (mapped to text by
 * the caller, `jobErrorKey` for a failed render). The job keeps running on the server if the app stops polling; it is
 * then simply listed in "Meine Dokumente" when done. Nothing is logged or stored.
 */
export function useDocumentGeneration(clubId: string | null) {
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const request = useCallback(
    async (templateId: string, params: Record<string, unknown>): Promise<GenerationOutcome | null> => {
      if (!clubId || busy.current) return null;
      busy.current = true;
      setWorking(true);
      let last: GenerationJob | null = null;
      try {
        const created = await apiFetch<{ data: GenerationJob }>(`/document-generation?clubId=${encodeURIComponent(clubId)}`, {
          method: 'POST',
          body: { templateId, params, idempotencyKey: newIdempotencyKey() },
        });
        last = created.data;
        const done = await pollJob(created.data, async (id) => (await apiFetch<{ data: GenerationJob }>(`/document-generation/jobs/${encodeURIComponent(id)}?clubId=${encodeURIComponent(clubId)}`)).data, {
          sleep,
          isCancelled: () => !alive.current,
        });
        if (!done) return null;
        return { ok: true, job: done };
      } catch (error) {
        // The job was created but a status poll failed (network): it keeps running on the server, so say "still running"
        // and let the file show up in the list instead of reporting a failure.
        if (last && isJobRunning(last)) return { ok: true, job: last };
        return { ok: false, error, job: last };
      } finally {
        busy.current = false;
        if (alive.current) setWorking(false);
      }
    },
    [clubId],
  );

  return { request, working };
}
