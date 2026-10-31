import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';

/**
 * Wave 12 M7 (P2) -- ride sharing of an event (`/events/:id/rides`). Pure helpers: types, summary line, request state of a
 * person and plain-language error keys. The departure place stays hidden for people who are not involved (`placeHidden`).
 */

export type RequestStatus = 'angefragt' | 'zugesagt' | 'abgelehnt';

export interface RideRequestOwn {
  requestId: string;
  clubMemberId: string;
  status: RequestStatus;
}

export interface RideRequestForDriver extends RideRequestOwn {
  displayName: string | null;
  createdAt: string;
}

export interface Ride {
  id: string;
  driver: { clubMemberId: string; displayName: string | null };
  seats: number;
  seatsTaken: number;
  seatsFree: number;
  departureAt: string | null;
  departurePlace: string | null;
  note: string | null;
  placeHidden: boolean;
  mine: boolean;
  myRequests: RideRequestOwn[];
  /** Only for the driver / organisers. */
  requests?: RideRequestForDriver[];
  pendingCount: number;
}

export interface RidesView {
  eventId: string;
  rides: Ride[];
}

export const RIDE_SEATS_MAX = 8;
export const RIDE_PLACE_MAX = 200;
export const RIDE_NOTE_MAX = 500;

export function totalFreeSeats(view: Pick<RidesView, 'rides'>): number {
  return view.rides.reduce((n, r) => n + Math.max(0, r.seatsFree), 0);
}

/** The driver or an organiser: the backend sends `requests` only to them, so their presence decides who may decide. */
export function managesRequests(ride: Pick<Ride, 'mine' | 'requests'>): boolean {
  return ride.mine || ride.requests !== undefined;
}

/** The request of `subject` (`null` = the caller; a ward by club member id) on this ride. */
export function requestOf(ride: Ride, subject: string | null, callerClubMemberId: string | null): RideRequestOwn | null {
  const id = subject ?? callerClubMemberId;
  if (!id) return null;
  return ride.myRequests.find((r) => r.clubMemberId === id) ?? null;
}

export interface RideDraft {
  seats: number;
  place: string;
  departureAt: Date | null;
  note: string;
}

export function rideDraftProblem(draft: RideDraft): 'place' | 'seats' | null {
  if (!draft.place.trim()) return 'place';
  if (!Number.isInteger(draft.seats) || draft.seats < 1 || draft.seats > RIDE_SEATS_MAX) return 'seats';
  return null;
}

export function createRideBody(draft: RideDraft): { seats: number; departurePlace: string; departureAt?: string; note?: string } {
  const note = draft.note.trim().slice(0, RIDE_NOTE_MAX);
  return {
    seats: draft.seats,
    departurePlace: draft.place.trim().slice(0, RIDE_PLACE_MAX),
    ...(draft.departureAt ? { departureAt: draft.departureAt.toISOString() } : {}),
    ...(note ? { note } : {}),
  };
}

const DETAIL_KEYS: Record<string, string> = {
  driver_must_be_adult: 'ride.err.adult',
  too_many_rides: 'ride.err.too-many',
  minor_needs_guardian: 'ride.err.minor',
  request_exists: 'ride.err.request-exists',
  ride_full: 'ride.err.full',
  seats_below_confirmed: 'ride.err.seats-below',
};

export function rideErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.details as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(DETAIL_KEYS, code)) return DETAIL_KEYS[code]!;
    if (err.status === 403) return 'help.err.not-allowed';
  }
  return apiErrorKey(err);
}
