jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import {
  helperErrorKey,
  isSubjectOnShift,
  openShiftCount,
  ownSwap,
  shiftTone,
  subjectQuery,
  swapCandidates,
  takeableSwaps,
  totalShifts,
  type HelperPlan,
  type HelperShift,
} from './helpers';

const shift = (id: string, over: Partial<HelperShift> = {}): HelperShift => ({
  id,
  startsAt: '2026-07-01T10:00:00Z',
  endsAt: '2026-07-01T12:00:00Z',
  capacity: 2,
  minStaff: 1,
  filled: 0,
  free: 2,
  full: false,
  understaffed: false,
  mine: false,
  mySignupId: null,
  signups: [],
  swaps: [],
  ...over,
});
const plan = (shifts: HelperShift[]): HelperPlan => ({
  eventId: 'e',
  cancelled: false,
  canManage: false,
  stations: [{ id: 's', name: 'Grill', description: null, sortOrder: 0, shifts }],
  mine: [],
});

describe('helper plan helpers', () => {
  it('derives the traffic light with understaffed first', () => {
    expect(shiftTone({ understaffed: true, full: false })).toBe('understaffed');
    expect(shiftTone({ understaffed: false, full: true })).toBe('full');
    expect(shiftTone({ understaffed: false, full: false })).toBe('open');
  });

  it('counts shifts and shifts that lack people', () => {
    const p = plan([shift('a', { understaffed: true }), shift('b')]);
    expect(totalShifts(p)).toBe(2);
    expect(openShiftCount(p)).toBe(1);
  });

  it('recognises the caller or a ward on a shift', () => {
    const s = shift('a', { mine: true, signups: [{ signupId: 'x', clubMemberId: 'w1', displayName: 'Kind', mine: false }] });
    expect(isSubjectOnShift(s, null)).toBe(true);
    expect(isSubjectOnShift(s, 'w1')).toBe(true);
    expect(isSubjectOnShift(s, 'w2')).toBe(false);
    expect(isSubjectOnShift(shift('b'), null)).toBe(false);
  });

  it('finds the own open offer and the offers one could take', () => {
    const s = shift('a', {
      signups: [
        { signupId: 'me', clubMemberId: 'c1', displayName: 'Ich', mine: true },
        { signupId: 'o', clubMemberId: 'c2', displayName: 'Anna', mine: false },
      ],
      swaps: [
        { id: 'w1', signupId: 'me', fromClubMemberId: 'c1', fromName: 'Ich', toClubMemberId: null, toMe: false, mine: true, createdAt: 'x' },
        { id: 'w2', signupId: 'o', fromClubMemberId: 'c2', fromName: 'Anna', toClubMemberId: null, toMe: false, mine: false, createdAt: 'x' },
        { id: 'w3', signupId: 'o', fromClubMemberId: 'c2', fromName: 'Anna', toClubMemberId: 'c9', toMe: false, mine: false, createdAt: 'x' },
      ],
    });
    expect(ownSwap(s, null)?.id).toBe('w1');
    expect(takeableSwaps(s, null).map((w) => w.id)).toEqual(['w2']);
    expect(takeableSwaps(s, 'c9').map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
  });

  it('offers named people of other shifts as swap partners, never people already on this shift or the caller', () => {
    const p = plan([
      shift('a', { signups: [{ signupId: '1', clubMemberId: 'c1', displayName: 'Hier', mine: false }] }),
      shift('b', {
        signups: [
          { signupId: '2', clubMemberId: 'c1', displayName: 'Hier', mine: false },
          { signupId: '3', clubMemberId: 'c2', displayName: 'Zoe', mine: false },
          { signupId: '4', clubMemberId: 'c3', displayName: 'Anna', mine: false },
          { signupId: '5', clubMemberId: 'c4', displayName: null, mine: false },
          { signupId: '6', clubMemberId: 'c5', displayName: 'Ich', mine: true },
        ],
      }),
    ]);
    expect(swapCandidates(p, 'a', null).map((c) => c.displayName)).toEqual(['Anna', 'Zoe']);
  });

  it('maps conflicts to plain-language keys', () => {
    const e = (status: number, code?: string) => new ApiError(status, 'X', 'english', code ? { code } : undefined);
    expect(helperErrorKey(e(409, 'shift_full'))).toBe('help.err.full');
    expect(helperErrorKey(e(409, 'shift_overlap'))).toBe('help.err.overlap');
    expect(helperErrorKey(e(403, 'minor_needs_guardian'))).toBe('help.err.minor');
    expect(helperErrorKey(e(409, 'swap_closed'))).toBe('help.err.swap-closed');
    expect(helperErrorKey(e(403))).toBe('help.err.not-allowed');
    expect(helperErrorKey(e(404))).toBe('api.error.not-found');
  });

  it('puts the ward into the delete query', () => {
    expect(subjectQuery('c', null)).toBe('clubId=c');
    expect(subjectQuery('c', 'w 1')).toBe('clubId=c&clubMemberId=w%201');
  });
});
