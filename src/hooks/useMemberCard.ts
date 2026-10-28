import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import { type CachedCard, type MemberCard, cardSubjectKey, isCardGone, isOfflineFailure, shouldCacheCard } from '@/lib/memberCard';
import { dropCachedCard, loadCachedCard, saveCachedCard } from '@/lib/memberCardCache';

/** Whose card: the caller's own (`me`) or a ward's (`club_members.id`, guardian with a live link). */
export type MemberCardSubject = { kind: 'self'; clubId: string } | { kind: 'ward'; clubId: string; wardId: string };

export interface MemberCardView {
  /** Live answer, or the cached copy when the server could not be reached. */
  card: MemberCard | CachedCard['card'];
  /** Local photo file (cached) or the short-lived signed URL (live). */
  photoUri: string | null;
  /** The data comes from the device, not from the server just now. */
  fromCache: boolean;
  /** When the server last confirmed this card ("Stand von ..."). */
  checkedAt: string;
}

type Slot = { key: string; live: MemberCard | null; cached: CachedCard | null; error: unknown; settled: boolean };

/**
 * The membership card of one subject (M6). Shows the cached copy at once, then asks the server: a valid answer replaces
 * it and refreshes the cache; no network keeps the cached copy ("Stand von ..."); a 404/401/403 or any state other than
 * `gueltig` (revoked, left, expired, not issued) removes the local copy and shows the server's state. Reloads when the
 * app returns to the foreground so the token stays fresh. Every request is tagged with a sequence number and the
 * subject key, so a late answer for another child/club never lands (and never overwrites a newer one). Tokens, names and
 * photo URLs are never logged.
 */
export function useMemberCard(subject: MemberCardSubject | null) {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const enabled = isAuthenticated && !!subject && !!userId;
  const memberKey = subject ? (subject.kind === 'self' ? 'me' : subject.wardId) : '';
  const key = subject ? cardSubjectKey(subject.clubId, memberKey) : '';
  const clubId = subject?.clubId ?? '';
  const path = subject ? `/club-members/${encodeURIComponent(memberKey)}/card?clubId=${encodeURIComponent(clubId)}` : '';

  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(enabled);
  const requestId = useRef(0);
  const cachedRef = useRef<CachedCard | null>(null);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!enabled || !userId) {
      setSlot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Cached copy first, so a card is on screen before (or without) the network.
    const cached = await loadCachedCard(key, userId);
    if (id !== requestId.current) return;
    cachedRef.current = cached;
    setSlot((prev) => (prev && prev.key === key && prev.live ? prev : { key, live: null, cached, error: null, settled: false }));
    try {
      const { data } = await apiFetch<{ data: MemberCard }>(path);
      if (id !== requestId.current) return;
      if (shouldCacheCard(data)) {
        const saved = await saveCachedCard(key, data, userId, cachedRef.current);
        if (id !== requestId.current) return;
        cachedRef.current = saved;
        setSlot({ key, live: data, cached: saved, error: null, settled: true });
      } else {
        await dropCachedCard(key);
        if (id !== requestId.current) return;
        cachedRef.current = null;
        setSlot({ key, live: data, cached: null, error: null, settled: true });
      }
    } catch (error) {
      if (id !== requestId.current) return;
      if (isCardGone(error)) {
        await dropCachedCard(key);
        if (id !== requestId.current) return;
        cachedRef.current = null;
        setSlot({ key, live: null, cached: null, error, settled: true });
      } else {
        // Offline or a server problem: keep what is on the device (no live answer replaces it).
        setSlot((prev) => ({ key, live: prev && prev.key === key ? prev.live : null, cached: cachedRef.current, error, settled: true }));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [enabled, userId, key, path]);

  useEffect(() => {
    void reload();
    return () => {
      // Invalidates a running request: nothing is written after the screen or subject is gone.
      requestId.current++;
    };
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [enabled, reload]);

  const current = slot && slot.key === key && enabled ? slot : null;
  let view: MemberCardView | null = null;
  if (current?.live) {
    view = { card: current.live, photoUri: current.cached?.photoUri ?? current.live.photo?.url ?? null, fromCache: false, checkedAt: current.live.checkedAt };
    // Prefer the signed URL while online; the local file is the offline fallback.
    if (current.live.photo?.url) view.photoUri = current.live.photo.url;
  } else if (current?.cached) {
    view = { card: current.cached.card, photoUri: current.cached.photoUri, fromCache: true, checkedAt: current.cached.card.checkedAt };
  }
  const gone = !!current && current.settled && !current.live && !current.cached && isCardGone(current.error);
  const offline = !!current && current.settled && !current.live && !!current.cached && isOfflineFailure(current.error);
  const failed = !!current && current.settled && !view && !gone;
  return { view, loading: loading && !view, refreshing: loading, gone, offline, failed, error: current?.error ?? null, reload };
}
