import { ApiError } from './api';

/**
 * Pure helpers and types for the general assembly (Wave 11 M1-M5): ballots, voting, invitation, quorum, minutes, terms.
 * No React, no logging: choices, voter rolls and minutes are personal data and never leave the screen state.
 */

// --- Ballots ----------------------------------------------------------------------------------

export type BallotStatus = 'draft' | 'open' | 'closed' | 'counted' | 'finalized' | 'cancelled';
/** Derived by the backend from status and `opensAt`; the app never computes the window itself. */
export type BallotPhase = 'draft' | 'scheduled' | 'voting' | 'ended' | 'cancelled';
export type BallotOptionKind = 'yes' | 'no' | 'abstain' | 'choice' | 'candidate';

export interface BallotOption {
  id: string;
  position: number;
  label: string;
  kind: BallotOptionKind;
}

export interface BallotTally {
  optionId: string;
  label: string;
  kind: string;
  votes: number;
}

/** Frozen result (`finalized`; managers also see `counted`). */
export interface BallotResult {
  form?: string;
  outcome?: string;
  yes?: number;
  no?: number;
  abstain?: number;
  tallies?: BallotTally[];
  electedOptionIds?: string[];
  eligible?: number;
  participants?: number;
}

export interface BallotSummary {
  id: string;
  mode: 'in_session' | 'circular';
  kind: string;
  meetingId: string | null;
  electionId: string | null;
  title: string;
  description: string | null;
  secret: boolean;
  maxChoices: number;
  status: BallotStatus;
  phase: BallotPhase;
  opensAt: string | null;
  closesAt: string | null;
  options: BallotOption[];
  result: BallotResult | null;
  resultHash: string | null;
}

export interface MyBallotState {
  eligible: boolean;
  hasVoted: boolean;
  canVote: boolean;
  /** `null` for circular ballots. */
  checkedIn: boolean | null;
  /** Only for open (non-secret) ballots after voting; a secret ballot never echoes a choice. */
  ownVoteOptionIds: string[] | null;
  proxies: { grantorClubMemberId: string; displayName: string | null; hasVoted: boolean }[];
}

export interface BallotDetail extends BallotSummary {
  meeting: { id: string; title: string; scheduledAt: string | null } | null;
  me: MyBallotState;
  /** Managers only. */
  participation?: { eligible: number; voted: number };
}

/** Selection after tapping an option: one choice replaces, several are capped by `maxChoices` (abstain never mixes with others). */
export function toggleOption(selected: readonly string[], option: BallotOption, options: readonly BallotOption[], maxChoices: number): string[] {
  if (selected.includes(option.id)) return selected.filter((id) => id !== option.id);
  if (maxChoices <= 1 || option.kind === 'abstain') return [option.id];
  const abstainIds = options.filter((o) => o.kind === 'abstain').map((o) => o.id);
  const kept = selected.filter((id) => !abstainIds.includes(id));
  return kept.length >= maxChoices ? kept : [...kept, option.id];
}

export function canSubmitSelection(selected: readonly string[], maxChoices: number): boolean {
  return selected.length >= 1 && selected.length <= Math.max(1, maxChoices);
}

/** Whether the detail currently offers a vote. The server stays authoritative (window, roll, check-in). */
export function votingOpenFor(b: Pick<BallotDetail, 'phase' | 'me'>): boolean {
  return b.phase === 'voting' && b.me.canVote;
}

/** Proxy ballots (grantors the caller may still vote for). */
export function openProxies(b: Pick<BallotDetail, 'phase' | 'me'>): MyBallotState['proxies'] {
  return b.phase === 'voting' ? b.me.proxies.filter((p) => !p.hasVoted) : [];
}

export type VoteFailure = 'already_voted' | 'not_eligible' | 'not_checked_in' | 'closed' | 'not_started' | 'proxy' | 'rate_limit' | 'offline' | 'other';

/** Machine-readable reason of a failed vote; `offline` = no HTTP answer, so the vote is unknown and may be retried. */
export function voteFailure(err: unknown): VoteFailure {
  if (!(err instanceof ApiError)) return 'offline';
  const code = (err.details as { code?: unknown } | undefined)?.code;
  switch (code) {
    case 'already_voted':
      return 'already_voted';
    case 'not_eligible':
      return 'not_eligible';
    case 'not_checked_in':
      return 'not_checked_in';
    case 'ballot_closed':
      return 'closed';
    case 'ballot_not_started':
      return 'not_started';
    case 'no_proxy':
    case 'proxy_not_allowed':
    case 'grantor_present':
      return 'proxy';
    default:
      break;
  }
  if (err.status === 429) return 'rate_limit';
  if (err.status === 0 || err.status >= 502) return 'offline';
  return 'other';
}

/** A failed vote whose outcome is unknown (network, timeout) or already settled must reload the ballot before anything else. */
export function voteNeedsReload(f: VoteFailure): boolean {
  return f !== 'rate_limit' && f !== 'other';
}

export function isSettledPhase(phase: BallotPhase): boolean {
  return phase === 'ended' || phase === 'cancelled';
}

/** Open for voting now, newest first as delivered; what the "Abstimmungen" entry counts. */
export function votingNow(list: readonly BallotSummary[]): BallotSummary[] {
  return list.filter((b) => b.phase === 'voting');
}

// --- Assembly ---------------------------------------------------------------------------------

export type QuorumResult = 'beschlussfaehig' | 'nicht_beschlussfaehig' | 'regeln_fehlen';

export interface Quorum {
  rollFrozen: boolean;
  eligibleTotal: number;
  presentEligible: number;
  proxiesRepresented: number;
  represented: number;
  required: number | null;
  result: QuorumResult;
}

export interface AgendaItem {
  id: string;
  position: number;
  title: string;
  description: string | null;
  voteKind: string;
  announced: boolean;
}

export interface InvitationContent {
  id: string;
  version: number;
  kind: string;
  sentAt: string | null;
  /** Snapshot of what the members were invited to (frozen at sending). */
  content: {
    title?: string;
    scheduledAt?: string | null;
    place?: string | null;
    participationMode?: string;
    agenda?: { position: number; title: string; description: string | null; voteKind: string }[];
    agendaText?: string | null;
    message?: string | null;
  };
}

export interface ProxyRow {
  id: string;
  grantorClubMemberId: string | null;
  grantorName: string | null;
  holderClubMemberId: string | null;
  holderName: string | null;
}

export interface VotingRollMe {
  frozen: boolean;
  eligible: boolean;
  basis: string;
}

export interface AttendanceMember {
  clubMemberId: string | null;
  displayName?: string | null;
  present: boolean;
  checkedInAt: string | null;
  leftAt: string | null;
  proxyFor: string[];
}

export interface InviteeRow {
  clubMemberId: string;
  displayName?: string | null;
  response: string;
}

export type CheckInState = 'present' | 'left' | 'absent';

export function checkInState(a: Pick<AttendanceMember, 'present' | 'leftAt'> | undefined): CheckInState {
  if (!a) return 'absent';
  if (a.present) return 'present';
  return a.leftAt ? 'left' : 'absent';
}

export interface CheckInRow {
  clubMemberId: string;
  displayName: string;
  state: CheckInState;
  proxyCount: number;
}

/** Check-in list: every invitee and everybody already on the attendance list (members without an account included), filtered by name. */
export function buildCheckInRows(invitees: readonly InviteeRow[], attendance: readonly AttendanceMember[], query: string): CheckInRow[] {
  const byId = new Map<string, CheckInRow>();
  for (const a of attendance) {
    if (!a.clubMemberId) continue;
    byId.set(a.clubMemberId, { clubMemberId: a.clubMemberId, displayName: a.displayName ?? '', state: checkInState(a), proxyCount: a.proxyFor.length });
  }
  for (const i of invitees) {
    const existing = byId.get(i.clubMemberId);
    if (existing) {
      if (!existing.displayName) existing.displayName = i.displayName ?? '';
    } else byId.set(i.clubMemberId, { clubMemberId: i.clubMemberId, displayName: i.displayName ?? '', state: 'absent', proxyCount: 0 });
  }
  const q = query.trim().toLocaleLowerCase();
  return [...byId.values()].filter((r) => !q || r.displayName.toLocaleLowerCase().includes(q)).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type MinutesStatus = 'entwurf' | 'zur_genehmigung' | 'genehmigt' | 'archiviert';

export interface MinutesVersion {
  id: string;
  version: number;
  status: MinutesStatus;
  approved: boolean;
  content: string;
  approvedAt: string | null;
}

export interface MinutesView {
  current: MinutesVersion | null;
  amendments: { id: string; version: number; note: string; createdAt: string }[];
}

// --- Terms (Amtszeit) ---------------------------------------------------------------------------

/** Own board roles whose term is over or ends within `warnDays` (a date string `YYYY-MM-DD`). */
export function expiringTerms<T extends { termEndsAt: string | null }>(roles: readonly T[], now: Date, warnDays = 60): (T & { daysLeft: number })[] {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return roles.flatMap((r) => {
    if (!r.termEndsAt) return [];
    const [y, m, d] = r.termEndsAt.split('-').map(Number);
    if (!y || !m || !d) return [];
    const daysLeft = Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
    return daysLeft <= warnDays ? [{ ...r, daysLeft }] : [];
  });
}

/** The meetings the assembly area lists: general assemblies that are not still in date finding. */
export function isAssemblyMeeting(m: { type: string; status: string }): boolean {
  return m.type === 'mitgliederversammlung' && m.status !== 'terminfindung';
}
