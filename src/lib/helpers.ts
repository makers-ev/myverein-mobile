import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';

/**
 * Wave 12 M6 -- helper plan (stations, shifts, sign-up, give away / swap) of `GET /events/:id/helpers`. Pure helpers: types,
 * the traffic light, who may be acted for, swap candidates and plain-language error keys. Names are not logged.
 */

export interface HelperSignup {
  signupId: string;
  clubMemberId: string;
  displayName: string | null;
  mine: boolean;
}

export interface HelperSwap {
  id: string;
  signupId: string;
  fromClubMemberId: string;
  fromName: string | null;
  toClubMemberId: string | null;
  toMe: boolean;
  mine: boolean;
  createdAt: string;
}

export interface HelperShift {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  minStaff: number;
  filled: number;
  free: number;
  full: boolean;
  understaffed: boolean;
  mine: boolean;
  mySignupId: string | null;
  signups: HelperSignup[];
  swaps: HelperSwap[];
}

export interface HelperStation {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  shifts: HelperShift[];
}

export interface MyShift {
  shiftId: string;
  stationId: string;
  stationName: string;
  startsAt: string;
  endsAt: string;
  signupId: string;
}

export interface HelperPlan {
  eventId: string;
  cancelled: boolean;
  canManage: boolean;
  stations: HelperStation[];
  mine: MyShift[];
}

export type ShiftTone = 'understaffed' | 'full' | 'open';

/** Red = fewer people than the minimum, green = full, otherwise yellow. Always shown with a text, never by colour alone. */
export function shiftTone(shift: Pick<HelperShift, 'understaffed' | 'full'>): ShiftTone {
  if (shift.understaffed) return 'understaffed';
  if (shift.full) return 'full';
  return 'open';
}

export function totalShifts(plan: Pick<HelperPlan, 'stations'>): number {
  return plan.stations.reduce((n, s) => n + s.shifts.length, 0);
}

/** Shifts that still lack people (below the minimum): the number a "helpers needed" hint shows. */
export function openShiftCount(plan: Pick<HelperPlan, 'stations'>): number {
  return plan.stations.reduce((n, s) => n + s.shifts.filter((sh) => sh.understaffed).length, 0);
}

/** Is `subject` (`null` = the caller) on this shift? Wards are matched by their club member id. */
export function isSubjectOnShift(shift: HelperShift, subject: string | null): boolean {
  return subject === null ? shift.mine : shift.signups.some((s) => s.clubMemberId === subject);
}

/** The sign-up of `subject` on this shift. */
export function subjectSignup(shift: HelperShift, subject: string | null): HelperSignup | null {
  return (subject === null ? shift.signups.find((s) => s.mine) : shift.signups.find((s) => s.clubMemberId === subject)) ?? null;
}

/** The open swap offered by `subject` on this shift, if any. */
export function ownSwap(shift: HelperShift, subject: string | null): HelperSwap | null {
  const signup = subjectSignup(shift, subject);
  return (signup ? shift.swaps.find((w) => w.signupId === signup.signupId) : null) ?? null;
}

/** Offers on this shift that `subject` could take over (open offers of other people, or offers addressed to them). */
export function takeableSwaps(shift: HelperShift, subject: string | null): HelperSwap[] {
  return shift.swaps.filter((w) => !isOwnOffer(w, subject) && (subject === null ? w.toClubMemberId === null || w.toMe : w.toClubMemberId === null || w.toClubMemberId === subject));
}

function isOwnOffer(swap: HelperSwap, subject: string | null): boolean {
  return subject === null ? swap.mine : swap.fromClubMemberId === subject;
}

export interface SwapCandidate {
  clubMemberId: string;
  displayName: string;
}

/** People of OTHER shifts of the event (named only) that `subject` could swap with; nobody already on this shift. */
export function swapCandidates(plan: Pick<HelperPlan, 'stations'>, shiftId: string, subject: string | null): SwapCandidate[] {
  const here = new Set<string>();
  const seen = new Map<string, SwapCandidate>();
  for (const station of plan.stations) {
    for (const shift of station.shifts) {
      if (shift.id === shiftId) for (const s of shift.signups) here.add(s.clubMemberId);
    }
  }
  for (const station of plan.stations) {
    for (const shift of station.shifts) {
      if (shift.id === shiftId) continue;
      for (const s of shift.signups) {
        if (!s.displayName || here.has(s.clubMemberId) || s.clubMemberId === subject) continue;
        if (subject === null && s.mine) continue;
        seen.set(s.clubMemberId, { clubMemberId: s.clubMemberId, displayName: s.displayName });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

const DETAIL_KEYS: Record<string, string> = {
  shift_full: 'help.err.full',
  shift_overlap: 'help.err.overlap',
  shift_over: 'help.err.over',
  minor_needs_guardian: 'help.err.minor',
  swap_open: 'help.err.swap-open',
  already_signed_up: 'help.err.already',
  swap_closed: 'help.err.swap-closed',
  swap_not_for_you: 'help.err.swap-not-for-you',
  event_cancelled: 'help.err.cancelled',
};

/** Plain-language key of a failed helper call; the English server text never reaches the UI. */
export function helperErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.details as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(DETAIL_KEYS, code)) return DETAIL_KEYS[code]!;
    if (err.status === 403) return 'help.err.not-allowed';
  }
  return apiErrorKey(err);
}

export function helpersPath(eventId: string, clubId: string): string {
  return `/events/${encodeURIComponent(eventId)}/helpers?clubId=${encodeURIComponent(clubId)}`;
}

/** `?clubId=&clubMemberId=` (a ward) for the self-service routes whose DELETE carries the subject in the query. */
export function subjectQuery(clubId: string, subject: string | null): string {
  return `clubId=${encodeURIComponent(clubId)}${subject ? `&clubMemberId=${encodeURIComponent(subject)}` : ''}`;
}
