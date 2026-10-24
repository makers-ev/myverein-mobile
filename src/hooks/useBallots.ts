import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { apiFetch } from '@/lib/api';
import { voteFailure, voteNeedsReload, type BallotDetail, type BallotSummary, type VoteFailure } from '@/lib/assembly';
import { useScopedResource } from './useScopedResource';

/** `GET /ballots?clubId=`: the ballots the caller may see (members: no drafts; circular only when on the voter roll). Never persisted. */
export function useBallots(clubId: string | null) {
  const path = clubId ? `/ballots?clubId=${encodeURIComponent(clubId)}` : null;
  const { data, loading, error, reload } = useScopedResource<BallotSummary[]>(path);
  return { ballots: data ?? [], loading, error, reload };
}

export type VoteOutcome = { ok: true; alreadyCounted: boolean } | { ok: false; failure: VoteFailure };

/** Longest delay a timer can take; a window further away is reloaded by the next screen visit anyway. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * One ballot with `me`/`phase` and the vote action. Race protection:
 * - only one vote request at a time (`inFlight`), so a double tap sends once;
 * - the server is authoritative for the window: when `opensAt`/`closesAt` passes while the person is still choosing, the
 *   ballot is reloaded (phase flips, the screen stops offering the vote) and the selection stays visible until then;
 * - a vote whose answer was lost (offline) or already settled (409) reloads the ballot; a retry of a vote that did go
 *   through answers `already_voted`, which counts as done (`alreadyCounted`), never as a second vote.
 * The choice is only kept in the calling component's state and is never logged or stored.
 */
export function useBallot(clubId: string | null, ballotId: string | null) {
  const path = clubId && ballotId ? `/ballots/${encodeURIComponent(ballotId)}?clubId=${encodeURIComponent(clubId)}` : null;
  const { data, loading, error, reload } = useScopedResource<BallotDetail>(path);
  const inFlight = useRef(false);
  const [voting, setVoting] = useState(false);

  // Coming back to the app or to this screen: the window or the right may have changed meanwhile.
  const focused = useIsFocused();
  const wasFocused = useRef(focused);
  useEffect(() => {
    if (focused && !wasFocused.current) void reload();
    wasFocused.current = focused;
  }, [focused, reload]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  // Reload when the voting window starts or ends. `rearm` re-runs the timer after each timer reload (e.g. the window was extended).
  const [rearm, setRearm] = useState(0);
  const opensAt = data?.opensAt ?? null;
  const closesAt = data?.closesAt ?? null;
  const phase = data?.phase ?? null;
  useEffect(() => {
    const target = phase === 'scheduled' ? opensAt : phase === 'voting' ? closesAt : null;
    if (!target) return;
    const wait = new Date(target).getTime() - Date.now();
    const timer = setTimeout(() => {
      void reload().then(() => setRearm((n) => n + 1));
    }, Math.min(Math.max(wait, 0) + 500, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [phase, opensAt, closesAt, reload, rearm]);

  const castVote = useCallback(
    async (optionIds: string[], forClubMemberId?: string): Promise<VoteOutcome> => {
      if (!clubId || !ballotId || inFlight.current) return { ok: false, failure: 'other' };
      inFlight.current = true;
      setVoting(true);
      try {
        await apiFetch(`/ballots/${encodeURIComponent(ballotId)}/vote?clubId=${encodeURIComponent(clubId)}`, {
          method: 'POST',
          body: forClubMemberId ? { optionIds, forClubMemberId } : { optionIds },
        });
        await reload();
        return { ok: true, alreadyCounted: false };
      } catch (err) {
        const failure = voteFailure(err);
        const fresh = voteNeedsReload(failure) ? await reload() : null;
        // The earlier attempt did arrive (or the server says so): the vote exists exactly once.
        if (failure === 'already_voted') return { ok: true, alreadyCounted: true };
        if (fresh && failure === 'offline') {
          const counted = forClubMemberId ? fresh.me.proxies.some((p) => p.grantorClubMemberId === forClubMemberId && p.hasVoted) : fresh.me.hasVoted;
          if (counted) return { ok: true, alreadyCounted: true };
        }
        return { ok: false, failure };
      } finally {
        inFlight.current = false;
        setVoting(false);
      }
    },
    [clubId, ballotId, reload],
  );

  return { ballot: data, loading, error, reload, castVote, voting };
}
