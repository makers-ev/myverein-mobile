import { useCallback, useEffect, useRef, useState } from 'react';

import { clearDocumentFileCache, downloadDocumentFile } from '@/lib/media';
import { shareLocalFile } from '@/lib/shareFile';

export interface DocumentToOpen {
  /** Stable id of the row (busy marker), no content. */
  id: string;
  /** Authenticated download path from `lib/documents.ts` (club-info attachment, archive or personal document). */
  path: string;
  title: string;
  mimeType: string | null | undefined;
}

/**
 * Download a document with the session cookie into the app cache and hand it to the share/open sheet. One download at
 * a time (a second tap while busy is ignored), unmount aborts a running transfer and clears the cache folder so no
 * personal document stays on the device. The error is the raw failure (mapped to text by the caller); nothing about the
 * document is logged.
 */
export function useDocumentOpen() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [unsupported, setUnsupported] = useState(false);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  // Own cache sub folder: closing this screen removes only its files, never those of another open document screen.
  // Leftovers of a killed session are removed at app start and on sign-out (`AuthProvider`).
  const [scope] = useState(() => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    alive.current = true;
    const mine = scope;
    return () => {
      alive.current = false;
      controller.current?.abort();
      clearDocumentFileCache(mine);
    };
  }, [scope]);

  const open = useCallback(async (doc: DocumentToOpen) => {
    if (busy.current) return;
    busy.current = true;
    setBusyId(doc.id);
    setError(null);
    setUnsupported(false);
    const ctrl = new AbortController();
    controller.current = ctrl;
    try {
      const result = await downloadDocumentFile(doc.path, doc.title, doc.mimeType, ctrl.signal, scope);
      if (!alive.current) return;
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const shared = await shareLocalFile(result.uri, result.mimeType, doc.title);
      if (alive.current && !shared) setUnsupported(true);
    } catch (err) {
      if (alive.current) setError(err);
    } finally {
      busy.current = false;
      controller.current = null;
      if (alive.current) setBusyId(null);
    }
  }, [scope]);

  const clearError = useCallback(() => {
    setError(null);
    setUnsupported(false);
  }, []);

  return { open, busyId, error, unsupported, clearError };
}
