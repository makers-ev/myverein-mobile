import { useEffect } from 'react';

import { useMyClubs } from '@/hooks/useMyClubs';
import type { PushRoute, PushTarget } from './pushLogic';
import { clearPushTarget, useRoutedPushTarget } from './pushTargetStore';

/**
 * For a destination screen: the routed push target once the club it belongs to is the active one.
 * Switches the active club when the user is a member of it; `unreachable` = the user is no member
 * of that club (any more), so the screen shows its friendly "no longer available" notice.
 * The screen calls `consume()` as soon as it handled the target.
 */
export function usePushScreenTarget(route: PushRoute): {
  target: PushTarget | null;
  ready: boolean;
  unreachable: boolean;
  consume: () => void;
} {
  const target = useRoutedPushTarget(route);
  const { clubs, activeClub, loading, setActiveClubId } = useMyClubs();
  const wantedClub = target?.clubId ?? null;
  const isMember = !!wantedClub && clubs.some((c) => c.clubId === wantedClub);

  useEffect(() => {
    if (!target || loading) return;
    if (wantedClub && isMember && activeClub?.clubId !== wantedClub) setActiveClubId(wantedClub);
  }, [target, loading, wantedClub, isMember, activeClub?.clubId, setActiveClubId]);

  const settled = !!target && !loading;
  const unreachable = settled && (!activeClub || (!!wantedClub && !isMember));
  const ready = settled && !unreachable && (!wantedClub || activeClub?.clubId === wantedClub);
  return { target, ready, unreachable, consume: clearPushTarget };
}
