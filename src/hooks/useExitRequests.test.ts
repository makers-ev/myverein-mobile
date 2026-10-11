import { activeCancellation, exitErrorCode, formatDay, todayBerlin, type ExitRequest } from './useExitRequests';
import { normalizeClaimedRole } from './useClubRegistration';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/media', () => ({ uploadRegistrationDocument: jest.fn() }));

const req = (over: Partial<ExitRequest>): ExitRequest => ({
  id: 'r',
  clubMemberId: 'm',
  memberName: null,
  hasAccount: true,
  kind: 'cancellation',
  status: 'pending',
  requestedBy: 'u',
  requestedOn: '2026-10-01',
  desiredEffectiveOn: null,
  effectiveOn: null,
  earliestEffectiveOn: null,
  proposedEffectiveOn: null,
  reason: null,
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

describe('exitErrorCode', () => {
  it('reads details.code of an API error', () => {
    expect(exitErrorCode({ details: { code: 'owner_protected' } })).toBe('owner_protected');
    expect(exitErrorCode({ details: { code: 'board_protected' } })).toBe('board_protected');
  });
  it('returns null without a code', () => {
    expect(exitErrorCode(new Error('x'))).toBeNull();
    expect(exitErrorCode({ details: [] })).toBeNull();
    expect(exitErrorCode(null)).toBeNull();
  });
});

describe('formatDay', () => {
  it('shows a dash for missing dates', () => {
    expect(formatDay(null)).toBe('—');
  });
  it('does not shift the calendar day', () => {
    expect(formatDay('2026-12-31T00:00:00.000Z')).toBe(new Date('2026-12-31T00:00').toLocaleDateString());
  });
});

describe('todayBerlin', () => {
  it('uses the Berlin calendar day, not the UTC one', () => {
    // 23:30 UTC on 30 Jun is already 1 Jul in Berlin (CEST).
    expect(todayBerlin(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
    // 23:30 UTC on 15 Jan is 16 Jan in Berlin (CET).
    expect(todayBerlin(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
    expect(todayBerlin(new Date('2026-03-10T10:00:00Z'))).toBe('2026-03-10');
  });
});

describe('activeCancellation', () => {
  it('prefers a pending request', () => {
    expect(activeCancellation([req({ id: 'a', status: 'approved', effectiveOn: '2027-01-01' }), req({ id: 'b' })], '2026-10-11')?.id).toBe('b');
  });
  it('keeps an approved exit only while its date is in the future', () => {
    const approved = req({ status: 'approved', effectiveOn: '2026-12-31' });
    expect(activeCancellation([approved], '2026-10-11')).not.toBeNull();
    expect(activeCancellation([approved], '2026-12-31')).toBeNull();
  });
  it('ignores rejected, withdrawn and exclusions', () => {
    expect(activeCancellation([req({ status: 'rejected' }), req({ status: 'withdrawn' }), req({ kind: 'exclusion', status: 'approved', effectiveOn: '2027-01-01' })], '2026-10-11')).toBeNull();
  });
});

describe('normalizeClaimedRole', () => {
  it('keeps claimable roles and replaces the removed schriftfuehrer', () => {
    expect(normalizeClaimedRole('stellv_vorsitz')).toBe('stellv_vorsitz');
    expect(normalizeClaimedRole('schriftfuehrer')).toBe('vorsitz');
    expect(normalizeClaimedRole(undefined)).toBe('vorsitz');
  });
});
