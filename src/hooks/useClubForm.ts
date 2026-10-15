import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import {
  allowedModes,
  type FormDefinition,
  formErrorKey,
  type MySubmission,
  type OnBehalfOf,
  selectApplicationState,
  type Submission,
} from '@/lib/formSchema';

export interface ClubFormState {
  slug: string;
  definition: FormDefinition;
  /** Own applications of this club that wait for a decision. */
  submitted: MySubmission[];
  modes: OnBehalfOf[];
  mode: OnBehalfOf | null;
  /** The newest open draft of `mode` with the definition it is pinned to. */
  resume?: { submission: Submission; form: FormDefinition; outdated: boolean };
  /** Bumped whenever the form has to start over (mode switch, discarded draft, reload). */
  formKey: number;
}

export type ClubFormPhase = 'slug' | 'loading' | 'ready';

/**
 * Loads the application form of a club by its code (`GET /club-forms/:slug/aufnahme`) together with the person's own
 * submissions (`GET /form-submissions/mine`, drafts and pending applications of this club) and the newest draft of the
 * chosen applicant mode (`GET /form-submissions/:id`). Race-safe: every load takes a sequence number and only the newest
 * may write state, so a late answer for another club (or an older reload) is dropped; unmounting drops everything. A reload
 * while a club is shown keeps it on screen (`refreshing` / `refreshFailed`). Nothing is cached or persisted: drafts live on
 * the server.
 */
export function useClubForm() {
  const [club, setClub] = useState<ClubFormState | null>(null);
  const [phase, setPhase] = useState<ClubFormPhase>('slug');
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const clubRef = useRef<ClubFormState | null>(null);
  const loadSeq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    const aliveFlag = alive;
    const seq = loadSeq;
    aliveFlag.current = true;
    return () => {
      aliveFlag.current = false;
      seq.current++;
    };
  }, []);

  const commit = useCallback((next: ClubFormState | null) => {
    clubRef.current = next;
    setClub(next);
  }, []);

  /** `keepForm`: background refresh after a submit -- the list changes, the form the person may already be filling in stays. */
  const load = useCallback(
    async (clubSlug: string, preferred?: OnBehalfOf, keepForm = false): Promise<boolean> => {
      const seq = ++loadSeq.current;
      const reloading = clubRef.current !== null && clubRef.current.slug === clubSlug;
      if (reloading) setRefreshing(true);
      else setPhase('loading');
      setLoadErrorKey(null);
      setRefreshFailed(false);
      try {
        const [formRes, mineRes] = await Promise.all([
          apiFetch<{ data: FormDefinition }>(`/club-forms/${encodeURIComponent(clubSlug)}/aufnahme`),
          apiFetch<{ data: MySubmission[] }>('/form-submissions/mine'),
        ]);
        const definition = formRes.data;
        const { drafts, submitted } = selectApplicationState(mineRes.data, clubSlug);
        const modes = allowedModes(definition, submitted);
        const mode = preferred && modes.includes(preferred) ? preferred : (modes[0] ?? null);
        let resume: ClubFormState['resume'];
        const draft = mode ? drafts[mode] : undefined;
        if (draft) {
          try {
            const detail = await apiFetch<{ data: { submission: Submission; form: FormDefinition; outdated: boolean } }>(
              `/form-submissions/${draft.id}`,
            );
            resume = detail.data;
          } catch (err) {
            // Only a draft that is gone (404, e.g. swept meanwhile) is skipped. Any other failure must be visible: showing a
            // fresh empty form would let the person create a SECOND draft next to the one that could not be read.
            if (!(err instanceof ApiError && err.status === 404)) throw err;
          }
        }
        if (!alive.current || seq !== loadSeq.current) return false;
        const prev = clubRef.current;
        commit(
          keepForm && prev && prev.slug === clubSlug
            ? { ...prev, submitted, modes: allowedModes(prev.definition, submitted) }
            : { slug: clubSlug, definition, submitted, modes, mode, resume, formKey: (prev?.formKey ?? 0) + 1 },
        );
        setPhase('ready');
        setRefreshing(false);
        return true;
      } catch (err) {
        if (!alive.current || seq !== loadSeq.current) return false;
        setRefreshing(false);
        if (reloading) {
          // The club area stays; the person can retry.
          setRefreshFailed(true);
          return false;
        }
        setLoadErrorKey(err instanceof ApiError && err.status === 404 ? 'forms.apply.notFound' : formErrorKey(err));
        setPhase('slug');
        return false;
      }
    },
    [commit],
  );

  /** Back to the code entry (the owner finishes a pending autosave first). */
  const reset = useCallback(() => {
    loadSeq.current++;
    commit(null);
    setRefreshing(false);
    setRefreshFailed(false);
    setLoadErrorKey(null);
    setPhase('slug');
  }, [commit]);

  /**
   * Shows a just-filed application in the list right away (from the submit answer itself, so a failing reload cannot hide
   * it) and starts the form over for the remaining modes.
   */
  const markSubmitted = useCallback(
    (submission: Submission) => {
      const prev = clubRef.current;
      if (!prev) return;
      const entry = {
        ...submission,
        purpose: 'aufnahme',
        version: prev.definition.version,
        club: { id: '', name: '', slug: prev.slug },
      } as MySubmission;
      const submitted = [entry, ...prev.submitted.filter((s) => s.id !== entry.id)];
      const modes = allowedModes(prev.definition, submitted);
      commit({
        ...prev,
        submitted,
        modes,
        mode: prev.mode && modes.includes(prev.mode) ? prev.mode : (modes[0] ?? null),
        resume: undefined,
        formKey: prev.formKey + 1,
      });
    },
    [commit],
  );

  /** `POST /form-submissions/:id/withdraw`: closes a pending application (files are deleted, the answers stay as a record). Throws the `ApiError`. */
  const withdraw = useCallback(async (submissionId: string) => {
    await apiFetch(`/form-submissions/${encodeURIComponent(submissionId)}/withdraw`, { method: 'POST' });
  }, []);

  return { club, phase, loadErrorKey, refreshing, refreshFailed, load, reset, markSubmitted, withdraw };
}
