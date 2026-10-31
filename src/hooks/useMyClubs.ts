import { useActiveClub } from '@/clubs/ActiveClubProvider';

export type { MyClub } from '@/clubs/ActiveClubProvider';

/**
 * The caller's memberships (`GET /my-clubs`) plus the currently selected
 * club. State lives in `ActiveClubProvider` (shared by every screen, choice
 * persisted); this is a thin alias kept so screens read `activeClub` from one
 * place. `setActiveClubId` switches clubs (see `ClubSwitcher`).
 */
export function useMyClubs() {
  return useActiveClub();
}
