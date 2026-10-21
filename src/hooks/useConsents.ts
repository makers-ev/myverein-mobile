import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import { isConsentTextOutdated } from '@/lib/ward';
import { useScopedResource } from './useScopedResource';

export type ConsentState = 'granted' | 'revoked' | 'none';

/** One consent purpose with the person's current state (`memberConsentViews` in the backend). */
export interface ConsentView {
  purposeId: string;
  key: string;
  name: string;
  description: string | null;
  /** The club asks for it ("wird angefragt"); the consent stays voluntary either way. */
  requested: boolean;
  state: ConsentState;
  /** Asked for and not decided yet. */
  open: boolean;
  text: { id: string; version: number; body: string };
  recordedTextVersion: number | null;
  /** Decided against an older text version. */
  outdated: boolean;
  givenBy: string | null;
  decidedAt: string | null;
}

interface ConsentsData {
  consents: ConsentView[];
  open?: number;
  canConsent?: boolean;
}

/** Whose consents: the caller's own club-member row, or a ward's (guardian; deciding needs the link right `canConsent`). */
export type ConsentSubject = { kind: 'self'; clubId: string; clubMemberId: string } | { kind: 'ward'; clubId: string; wardId: string; canConsent: boolean };

export type ConsentResult = { ok: true } | { ok: false; outdated: boolean; error: unknown };

/**
 * Consents of one person. Reading: own row via `/club-members/:id/consents`, a child via the guardian route (404 = link
 * expired). Writing always goes through `/club-members/:id/consents/:purposeId` (same service and rules for everybody).
 * A grant carries the text version the person saw; on `409 consent_text_outdated` the list is refreshed so the sheet shows
 * the new text and the person decides again. Declining or revoking has no consequence for access, so there is nothing to
 * guard here. Consent texts and decisions are never logged or stored on the device.
 */
export function useConsents(subject: ConsentSubject | null) {
  const clubQ = subject ? `clubId=${encodeURIComponent(subject.clubId)}` : '';
  const memberId = subject ? (subject.kind === 'self' ? subject.clubMemberId : subject.wardId) : null;
  const readPath = subject && memberId ? (subject.kind === 'self' ? `/club-members/${encodeURIComponent(memberId)}/consents?${clubQ}` : `/guardian/wards/${encodeURIComponent(memberId)}/consents?${clubQ}`) : null;
  const { data, loading, error, reload, mutate } = useScopedResource<ConsentsData>(readPath);
  const canDecide = subject ? subject.kind === 'self' || subject.canConsent : false;

  const write = useCallback(
    async (view: ConsentView, method: 'POST' | 'DELETE'): Promise<ConsentResult> => {
      if (!memberId) return { ok: false, outdated: false, error: null };
      const url = `/club-members/${encodeURIComponent(memberId)}/consents/${encodeURIComponent(view.purposeId)}?${clubQ}`;
      try {
        const res =
          method === 'POST'
            ? await apiFetch<{ data: ConsentView | null }>(url, { method, body: { textVersionId: view.text.id } })
            : await apiFetch<{ data: ConsentView | null }>(url, { method });
        const updated = res?.data;
        if (updated) mutate((prev) => ({ ...prev, consents: prev.consents.map((c) => (c.purposeId === updated.purposeId ? updated : c)) }));
        void reload();
        return { ok: true };
      } catch (err) {
        const outdated = isConsentTextOutdated(err);
        // The text changed or the state is unknown: show what the server has now.
        void reload();
        return { ok: false, outdated, error: err };
      }
    },
    [memberId, clubQ, mutate, reload],
  );

  const grant = useCallback((view: ConsentView) => write(view, 'POST'), [write]);
  /** Revoke a granted consent or explicitly decline an open one. */
  const revoke = useCallback((view: ConsentView) => write(view, 'DELETE'), [write]);

  return { consents: data?.consents ?? [], open: (data?.consents ?? []).filter((c) => c.open).length, canDecide, loading, error, reload, grant, revoke };
}
