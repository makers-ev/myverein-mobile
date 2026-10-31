import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/apiErrorMessage';
import type { ClubMember, MemberStatus } from '@/hooks/useClubMembers';
import type { KeyHistoryEntry, LocationKeyHolder } from '@/hooks/useLocations';

/** Statuses that may be handed a key. */
const KEY_ELIGIBLE_STATUSES: readonly MemberStatus[] = ['probe', 'aktiv', 'ruhend'];

/** Members who can receive a key: with account, live status, not already holding one; filtered by name. */
export function eligibleKeyMembers(members: readonly ClubMember[], holders: readonly LocationKeyHolder[], query: string): ClubMember[] {
  const held = new Set(holders.map((h) => h.memberId));
  const q = query.trim().toLowerCase();
  return members
    .filter((m) => m.memberId && m.hasAccount && KEY_ELIGIBLE_STATUSES.includes(m.effectiveStatus) && !held.has(m.memberId))
    .filter((m) => !q || (m.name ?? '').toLowerCase().includes(q))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

/** Display name of a holder: backend `memberName` first, then the newest history entry, else null. */
export function holderName(holder: LocationKeyHolder, history: readonly KeyHistoryEntry[]): string | null {
  if (holder.memberName) return holder.memberName;
  return history.find((e) => e.memberId === holder.memberId && e.memberName)?.memberName ?? null;
}

/** Translation key for a failed issue/return call; specific for the conflict/not-found cases, generic otherwise. */
export function keyErrorKey(err: unknown, action: 'issue' | 'return'): string {
  if (err instanceof ApiError) {
    if (action === 'issue' && err.status === 409) return 'standorte.keys.error.already-holder';
    if (action === 'return' && err.status === 404) return 'standorte.keys.error.not-holder';
  }
  return apiErrorKey(err);
}
