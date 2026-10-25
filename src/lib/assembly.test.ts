import { ApiError } from './api';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
import { buildCheckInRows, canSubmitSelection, expiringTerms, isAssemblyMeeting, openProxies, toggleOption, voteFailure, voteNeedsReload, votingOpenFor, type BallotOption } from './assembly';

const opt = (id: string, kind: BallotOption['kind'] = 'choice'): BallotOption => ({ id, position: 1, label: id, kind });
const options = [opt('a'), opt('b'), opt('c'), opt('abs', 'abstain')];

describe('toggleOption', () => {
  it('replaces the choice when only one is allowed', () => {
    expect(toggleOption(['a'], options[1]!, options, 1)).toEqual(['b']);
  });
  it('caps multiple choices and removes on second tap', () => {
    expect(toggleOption(['a', 'b'], options[2]!, options, 2)).toEqual(['a', 'b']);
    expect(toggleOption(['a', 'b'], options[1]!, options, 2)).toEqual(['a']);
  });
  it('never mixes abstain with other choices', () => {
    expect(toggleOption(['a'], options[3]!, options, 2)).toEqual(['abs']);
    expect(toggleOption(['abs'], options[0]!, options, 2)).toEqual(['a']);
  });
});

describe('canSubmitSelection', () => {
  it('needs 1..maxChoices', () => {
    expect(canSubmitSelection([], 1)).toBe(false);
    expect(canSubmitSelection(['a'], 1)).toBe(true);
    expect(canSubmitSelection(['a', 'b'], 1)).toBe(false);
  });
});

describe('voteFailure', () => {
  const api = (status: number, code?: string) => new ApiError(status, 'X', 'm', code ? { code } : undefined);
  it('maps machine codes', () => {
    expect(voteFailure(api(409, 'already_voted'))).toBe('already_voted');
    expect(voteFailure(api(409, 'ballot_closed'))).toBe('closed');
    expect(voteFailure(api(403, 'not_checked_in'))).toBe('not_checked_in');
    expect(voteFailure(api(403, 'no_proxy'))).toBe('proxy');
    expect(voteFailure(api(429))).toBe('rate_limit');
    expect(voteFailure(api(422))).toBe('other');
  });
  it('treats a missing HTTP answer as offline and reloads when the outcome is unknown', () => {
    expect(voteFailure(new Error('network'))).toBe('offline');
    expect(voteNeedsReload('offline')).toBe(true);
    expect(voteNeedsReload('already_voted')).toBe(true);
    expect(voteNeedsReload('rate_limit')).toBe(false);
  });
});

describe('ballot state', () => {
  const me = { eligible: true, hasVoted: false, canVote: true, checkedIn: true, ownVoteOptionIds: null, proxies: [{ grantorClubMemberId: 'g', displayName: 'G', hasVoted: false }, { grantorClubMemberId: 'h', displayName: 'H', hasVoted: true }] };
  it('offers the vote only while voting and allowed', () => {
    expect(votingOpenFor({ phase: 'voting', me })).toBe(true);
    expect(votingOpenFor({ phase: 'ended', me })).toBe(false);
    expect(votingOpenFor({ phase: 'voting', me: { ...me, canVote: false } })).toBe(false);
  });
  it('lists proxies that have not voted yet', () => {
    expect(openProxies({ phase: 'voting', me }).map((p) => p.grantorClubMemberId)).toEqual(['g']);
    expect(openProxies({ phase: 'ended', me })).toEqual([]);
  });
});

describe('buildCheckInRows', () => {
  const invitees = [{ clubMemberId: '1', displayName: 'Zoe', response: 'zugesagt' }, { clubMemberId: '2', displayName: 'Anna', response: 'ausstehend' }];
  const attendance = [{ clubMemberId: '1', displayName: 'Zoe', present: true, checkedInAt: 'x', leftAt: null, proxyFor: ['9'] }, { clubMemberId: '3', displayName: 'Ben', present: false, checkedInAt: 'x', leftAt: 'y', proxyFor: [] }];
  it('merges invitees and attendance, sorted by name, with states', () => {
    const rows = buildCheckInRows(invitees, attendance, '');
    expect(rows.map((r) => [r.displayName, r.state, r.proxyCount])).toEqual([['Anna', 'absent', 0], ['Ben', 'left', 0], ['Zoe', 'present', 1]]);
  });
  it('filters by name', () => {
    expect(buildCheckInRows(invitees, attendance, ' an ').map((r) => r.displayName)).toEqual(['Anna']);
  });
});

describe('expiringTerms', () => {
  const now = new Date(2026, 5, 10);
  it('returns terms over or ending within the warning window', () => {
    const roles = [{ id: 'a', termEndsAt: '2026-06-01' }, { id: 'b', termEndsAt: '2026-07-01' }, { id: 'c', termEndsAt: '2027-01-01' }, { id: 'd', termEndsAt: null }];
    expect(expiringTerms(roles, now).map((r) => [r.id, r.daysLeft])).toEqual([['a', -9], ['b', 21]]);
  });
});

describe('isAssemblyMeeting', () => {
  it('lists general assemblies except date finding', () => {
    expect(isAssemblyMeeting({ type: 'mitgliederversammlung', status: 'geplant' })).toBe(true);
    expect(isAssemblyMeeting({ type: 'mitgliederversammlung', status: 'terminfindung' })).toBe(false);
    expect(isAssemblyMeeting({ type: 'vorstandssitzung', status: 'geplant' })).toBe(false);
  });
});
