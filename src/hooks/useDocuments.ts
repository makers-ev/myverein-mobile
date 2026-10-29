import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import type { FoldersAnswer } from '@/lib/documents';
import { useScopedResource } from './useScopedResource';

/** One entry of the personal storage (`GET /member-documents/:memberId`). Title/filename are personal data: never logged. */
export interface PersonalDocument {
  id: string;
  title: string;
  docType: string | null;
  kind: string | null;
  source: 'member' | 'vorstand' | 'erzeugt';
  hidden: boolean;
  createdAt: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
  canDelete: boolean;
  canHide: boolean;
}

/** Whose personal storage: the caller's own (`me`) or a ward's (`club_members.id`, guardian with a live link). */
export type MemberDocumentsSubject = { kind: 'self'; clubId: string } | { kind: 'ward'; clubId: string; wardId: string };

/**
 * The personal documents of one subject (M4). Built on `useScopedResource`: the list is kept with its path (another
 * child's or club's answer is never shown), only the newest request writes, a failed reload keeps the last list. The
 * backend answers 404 when the link ended or the member may not see the storage: the error is exposed so the screen can
 * show a neutral "no access" instead of data. Hidden documents are not requested (`includeHidden` stays 0).
 */
export function useMemberDocuments(subject: MemberDocumentsSubject | null) {
  const path = subject
    ? `/member-documents/${subject.kind === 'self' ? 'me' : encodeURIComponent(subject.wardId)}?clubId=${encodeURIComponent(subject.clubId)}`
    : null;
  const { data, loading, error, reload } = useScopedResource<PersonalDocument[]>(path);
  return { documents: data, loading, error, reload };
}

/** Archive document (`D` of `GET /documents`); retention fields only exist at level `verwalten`, the app never shows them. */
export interface ArchiveDocument {
  id: string;
  folderId: string | null;
  kind: 'hochgeladen' | 'erzeugt';
  docType: string | null;
  title: string;
  status: 'aktiv' | 'im_papierkorb';
  createdAt: string;
  updatedAt: string;
  level: 'lesen' | 'schreiben' | 'verwalten';
  currentVersion: { versionNo: number; mimeType: string; sizeBytes: number; originalFilename: string | null; createdAt: string } | null;
}

/**
 * The readable archive folders (`GET /documents/folders`) of one club; also the probe for the archive entry (shown when
 * the member sees a folder or has a root level, see `canOpenArchive`). Answer kept with its club, newest request wins;
 * an error (403 for external guests) leaves `answer` null, i.e. no entry (deny by default).
 */
export function useArchiveFolders(clubId: string | null) {
  const { isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!clubId;
  const [stored, setStored] = useState<{ clubId: string; answer: FoldersAnswer } | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!enabled || !clubId) {
      setStored(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const answer = await apiFetch<FoldersAnswer>(`/documents/folders?clubId=${encodeURIComponent(clubId)}`);
      if (id === requestId.current) setStored({ clubId, answer });
    } catch (err) {
      if (id === requestId.current) {
        setStored(null);
        setError(err);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [enabled, clubId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const answer = stored && stored.clubId === clubId ? stored.answer : null;
  return { answer, loading, error, reload };
}

export const ARCHIVE_PAGE_SIZE = 30;

interface ArchivePage {
  data: ArchiveDocument[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Active documents of one archive folder, or the title search over everything readable (`q`, ignores the folder).
 * Page 1 per (club, folder, query); `loadMore` appends. Every request is tagged with its scope and a sequence number,
 * so a late answer for another folder/query/club never lands in the list.
 */
export function useArchiveDocuments(clubId: string | null, folderId: string | null, query: string) {
  const { isAuthenticated } = useAuth();
  const q = query.trim();
  const enabled = isAuthenticated && !!clubId && (!!folderId || q.length > 0);
  const scope = enabled ? `${clubId}|${q ? `q:${q}` : `f:${folderId}`}` : null;
  const [stored, setStored] = useState<{ scope: string; items: ArchiveDocument[]; total: number; page: number } | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      const id = ++requestId.current;
      if (!scope || !clubId) {
        setStored(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ clubId, status: 'aktiv', page: String(page), pageSize: String(ARCHIVE_PAGE_SIZE) });
      if (q) params.set('q', q);
      else if (folderId) params.set('folderId', folderId);
      try {
        const res = await apiFetch<ArchivePage>(`/documents?${params.toString()}`);
        if (id !== requestId.current) return;
        setStored((prev) => ({
          scope,
          items: append && prev && prev.scope === scope ? [...prev.items, ...res.data.filter((d) => !prev.items.some((p) => p.id === d.id))] : res.data,
          total: res.total,
          page: res.page,
        }));
      } catch (err) {
        if (id === requestId.current) setError(err);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [scope, clubId, folderId, q],
  );

  useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  const current = stored && stored.scope === scope ? stored : null;
  const hasMore = !!current && current.items.length < current.total;
  const loadMore = useCallback(() => {
    if (current && hasMore && !loading) void fetchPage(current.page + 1, true);
  }, [current, hasMore, loading, fetchPage]);

  return { documents: current?.items ?? null, total: current?.total ?? 0, loading, error, hasMore, loadMore, reload: () => fetchPage(1, false) };
}
