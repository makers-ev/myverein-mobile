import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch, ApiError } from '@/lib/api';
import { uploadRegistrationDocument } from '@/lib/media';

export type LegalForm = 'e_v' | 'nicht_eingetragen' | 'sonstige';
export type ClaimedRole = 'vorsitz' | 'stellv_vorsitz' | 'schriftfuehrer';
export type RegistrationStatus = 'draft' | 'pending' | 'needs_info' | 'approved' | 'rejected';
export type DocumentKind = 'registerauszug' | 'satzung' | 'freistellungsbescheid' | 'gruendungsprotokoll' | 'sonstiges';

export const LEGAL_FORMS: readonly LegalForm[] = ['e_v', 'nicht_eingetragen', 'sonstige'];
export const CLAIMED_ROLES: readonly ClaimedRole[] = ['vorsitz', 'stellv_vorsitz', 'schriftfuehrer'];
export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'registerauszug',
  'satzung',
  'freistellungsbescheid',
  'gruendungsprotokoll',
  'sonstiges',
];

export const MAX_DOCUMENTS = 5;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface RegistrationDocument {
  id: string;
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ClubRegistration {
  id: string;
  clubName: string;
  legalForm: LegalForm;
  registerCourt: string | null;
  registerNumber: string | null;
  street: string;
  postalCode: string;
  city: string;
  websiteUrl: string | null;
  claimedRole: ClaimedRole;
  status: RegistrationStatus;
  reviewNote: string | null;
  slugSuggestion: string | null;
  clubId: string | null;
  clubSlug: string | null;
  submittedAt: string | null;
  createdAt: string;
  documents: RegistrationDocument[];
}

/** Body of `POST /club-registrations` / `PATCH /club-registrations/:id`. */
export interface RegistrationInput {
  clubName: string;
  legalForm: LegalForm;
  registerCourt?: string | null;
  registerNumber?: string | null;
  street: string;
  postalCode: string;
  city: string;
  websiteUrl?: string | null;
  claimedRole: ClaimedRole;
}

export const isEditableStatus = (status: RegistrationStatus) => status === 'draft' || status === 'needs_info';

/**
 * Fetch-shaped hook for the caller's latest club registration
 * (`GET /club-registrations/mine`, newest first) plus the draft/document/
 * submit mutations. `registration` is always the newest one (or null).
 *
 * Race protection: every read/mutation that replaces the whole registration
 * bumps `requestId`, and only the newest request may write -- so an older
 * in-flight `refetch` can't overwrite a freshly saved draft or a submit
 * result. Document mutations patch the current registration functionally
 * and only if it is still the same registration id.
 */
export function useClubRegistration() {
  const { isAuthenticated } = useAuth();
  const [registration, setRegistration] = useState<ClubRegistration | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState(false);

  const requestId = useRef(0);
  // Mirrors `registration` for mutations (avoids stale closures).
  const current = useRef<ClubRegistration | null>(null);

  const apply = useCallback((next: ClubRegistration | null) => {
    current.current = next;
    setRegistration(next);
  }, []);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!isAuthenticated) {
      apply(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data } = await apiFetch<{ data: ClubRegistration[] }>('/club-registrations/mine');
      if (id === requestId.current) apply(data[0] ?? null);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [isAuthenticated, apply]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /**
   * Creates the draft (POST) or, when the newest registration is still
   * editable (draft / needs_info), patches it. A 409 on create means an
   * open registration already exists: reload it and rethrow.
   */
  const saveDraft = useCallback(
    async (input: RegistrationInput): Promise<ClubRegistration> => {
      const existing = current.current;
      const editing = existing && isEditableStatus(existing.status) ? existing : null;
      try {
        const { data } = editing
          ? await apiFetch<{ data: { registration: ClubRegistration } }>(`/club-registrations/${editing.id}`, {
              method: 'PATCH',
              body: input,
            })
          : await apiFetch<{ data: { registration: ClubRegistration } }>('/club-registrations', {
              method: 'POST',
              body: input,
            });
        requestId.current++;
        setLoading(false);
        apply(data.registration);
        return data.registration;
      } catch (err) {
        if (!editing && err instanceof ApiError && err.status === 409) void refetch();
        throw err;
      }
    },
    [apply, refetch],
  );

  const uploadDocument = useCallback(
    async (asset: { uri: string; name: string; type: string }, kind: DocumentKind): Promise<{ error?: string }> => {
      const reg = current.current;
      if (!reg) return { error: 'No registration' };
      const result = await uploadRegistrationDocument<RegistrationDocument>(reg.id, kind, asset);
      if ('error' in result) return { error: result.error };
      // Drop the result if the registration was replaced meanwhile.
      if (current.current?.id === reg.id) {
        apply({ ...current.current, documents: [...current.current.documents, result.document] });
      }
      return {};
    },
    [apply],
  );

  const removeDocument = useCallback(
    async (docId: string) => {
      const reg = current.current;
      if (!reg) return;
      await apiFetch(`/club-registrations/${reg.id}/documents/${docId}`, { method: 'DELETE' });
      if (current.current?.id === reg.id) {
        apply({ ...current.current, documents: current.current.documents.filter((d) => d.id !== docId) });
      }
    },
    [apply],
  );

  const submit = useCallback(async (): Promise<ClubRegistration> => {
    const reg = current.current;
    if (!reg) throw new Error('No registration');
    const { data } = await apiFetch<{ data: { registration: ClubRegistration } }>(
      `/club-registrations/${reg.id}/submit`,
      { method: 'POST' },
    );
    requestId.current++;
    setLoading(false);
    apply(data.registration);
    return data.registration;
  }, [apply]);

  return { registration, loading, error, refetch, saveDraft, uploadDocument, removeDocument, submit };
}
