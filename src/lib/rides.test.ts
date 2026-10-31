jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import { createRideBody, managesRequests, requestOf, rideDraftProblem, rideErrorKey, totalFreeSeats, type Ride } from './rides';

const ride = (over: Partial<Ride> = {}): Ride => ({
  id: 'r',
  driver: { clubMemberId: 'd', displayName: 'Fahrer' },
  seats: 4,
  seatsTaken: 1,
  seatsFree: 3,
  departureAt: null,
  departurePlace: null,
  note: null,
  placeHidden: true,
  mine: false,
  myRequests: [],
  pendingCount: 0,
  ...over,
});

describe('ride helpers', () => {
  it('sums free seats and never counts negative ones', () => {
    expect(totalFreeSeats({ rides: [ride(), ride({ seatsFree: -1 }), ride({ seatsFree: 2 })] })).toBe(5);
  });

  it('finds the request of the caller or of a ward', () => {
    const r = ride({
      myRequests: [
        { requestId: 'a', clubMemberId: 'me', status: 'angefragt' },
        { requestId: 'b', clubMemberId: 'kid', status: 'zugesagt' },
      ],
    });
    expect(requestOf(r, null, 'me')?.requestId).toBe('a');
    expect(requestOf(r, 'kid', 'me')?.requestId).toBe('b');
    expect(requestOf(r, 'other', 'me')).toBeNull();
    expect(requestOf(ride(), null, 'me')).toBeNull();
    expect(requestOf(r, null, null)).toBeNull();
    expect(managesRequests(ride({ requests: [] }))).toBe(true);
    expect(managesRequests(ride({ mine: true }))).toBe(true);
    expect(managesRequests(ride())).toBe(false);
  });

  it('validates the draft and builds a trimmed body', () => {
    expect(rideDraftProblem({ seats: 3, place: '  ', departureAt: null, note: '' })).toBe('place');
    expect(rideDraftProblem({ seats: 9, place: 'x', departureAt: null, note: '' })).toBe('seats');
    expect(rideDraftProblem({ seats: 2, place: 'x', departureAt: null, note: '' })).toBeNull();
    const at = new Date('2026-07-01T16:00:00Z');
    expect(createRideBody({ seats: 2, place: ' Parkplatz ', departureAt: at, note: ' ' })).toEqual({
      seats: 2,
      departurePlace: 'Parkplatz',
      departureAt: at.toISOString(),
    });
  });

  it('maps ride conflicts to plain-language keys', () => {
    const e = (status: number, code?: string) => new ApiError(status, 'X', 'english', code ? { code } : undefined);
    expect(rideErrorKey(e(422, 'driver_must_be_adult'))).toBe('ride.err.adult');
    expect(rideErrorKey(e(409, 'ride_full'))).toBe('ride.err.full');
    expect(rideErrorKey(e(403, 'minor_needs_guardian'))).toBe('ride.err.minor');
    expect(rideErrorKey(e(409, 'request_exists'))).toBe('ride.err.request-exists');
    expect(rideErrorKey(e(500))).toBe('api.error.server');
  });
});
