import { ApiError } from '@/lib/api';
import type { ClubMember } from '@/hooks/useClubMembers';

import { eligibleKeyMembers, holderName, keyErrorKey } from './keys';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

const m = (over: Partial<ClubMember>): ClubMember =>
  ({ id: 'c1', memberId: 'm1', hasAccount: true, name: 'Anna', effectiveStatus: 'aktiv', ...over }) as ClubMember;

describe('eligibleKeyMembers', () => {
  const members = [
    m({}),
    m({ id: 'c2', memberId: null, hasAccount: false, name: 'Kind' }),
    m({ id: 'c3', memberId: 'm3', name: 'Ben', effectiveStatus: 'ausgetreten' }),
    m({ id: 'c4', memberId: 'm4', name: 'Cora' }),
  ];
  it('keeps only live accounts that do not hold a key yet', () => {
    const res = eligibleKeyMembers(members, [{ id: 'k', locationId: 'l', memberId: 'm4' }], '');
    expect(res.map((x) => x.memberId)).toEqual(['m1']);
  });
  it('filters by name', () => {
    expect(eligibleKeyMembers(members, [], 'cor').map((x) => x.memberId)).toEqual(['m4']);
  });
});

describe('holderName', () => {
  it('falls back to history', () => {
    const history = [{ id: 'h', action: 'issued', memberId: 'x', memberName: 'Xaver', keyLabel: null, note: null, recordedBy: null, recordedByName: '', createdAt: '' }] as const;
    expect(holderName('x', [], history)).toBe('Xaver');
    expect(holderName('y', [], history)).toBeNull();
  });
});

describe('keyErrorKey', () => {
  it('maps conflict and not-found specifically', () => {
    expect(keyErrorKey(new ApiError(409, 'CONFLICT', 'x'), 'issue')).toBe('standorte.keys.error.already-holder');
    expect(keyErrorKey(new ApiError(404, 'NOT_FOUND', 'x'), 'return')).toBe('standorte.keys.error.not-holder');
    expect(keyErrorKey(new ApiError(403, 'FORBIDDEN', 'x'), 'issue')).toBe('api.error.forbidden');
  });
});
