import type { MySubmission } from '@/lib/formSchema';
import { findOpenDraft, formatBerlinDate, normalizeClubSlug, selectApplicationStatus } from './applicationStatus';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const sub = (over: Partial<MySubmission>): MySubmission => ({
  id: 'x',
  formVersionId: 'v',
  onBehalfOf: 'self',
  status: 'draft',
  answers: {},
  files: [],
  submittedAt: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: '2026-10-01T10:00:00Z',
  purpose: 'aufnahme',
  version: 1,
  club: { id: 'c', name: 'Demo', slug: 'demo' },
  ...over,
});

describe('selectApplicationStatus', () => {
  it('lists drafts and pending applications as open, newest first, ignoring other purposes', () => {
    const { open } = selectApplicationStatus(
      [sub({ id: 'a', createdAt: '2026-10-01T10:00:00Z' }), sub({ id: 'b', status: 'submitted', submittedAt: '2026-10-05T10:00:00Z' }), sub({ id: 'c', purpose: 'austritt' })],
      NOW,
    );
    expect(open.map((o) => o.id)).toEqual(['b', 'a']);
  });

  it('keeps the note of a rejected application only', () => {
    const { decided } = selectApplicationStatus(
      [
        sub({ id: 'r', status: 'rejected', decidedAt: '2026-10-10T10:00:00Z', decisionNote: '  Leider voll.  ' }),
        sub({ id: 'a', status: 'accepted', decidedAt: '2026-10-09T10:00:00Z', decisionNote: 'Willkommen' }),
        sub({ id: 'w', status: 'withdrawn', decidedAt: '2026-10-08T10:00:00Z' }),
        sub({ id: 'e', status: 'rejected', decidedAt: '2026-10-07T10:00:00Z', decisionNote: '   ', club: { id: 'z', name: 'Z', slug: 'zeta' } }),
      ],
      NOW,
    );
    expect(decided.map((d) => [d.id, d.decisionNote])).toEqual([['r', 'Leider voll.'], ['a', null], ['w', null], ['e', null]]);
  });

  it('drops old decisions and caps per club', () => {
    const many = [1, 2, 3, 4].map((n) => sub({ id: `d${n}`, status: 'rejected', decidedAt: `2026-10-0${n}T10:00:00Z` }));
    const other = sub({ id: 'o', status: 'accepted', decidedAt: '2026-10-01T10:00:00Z', club: { id: 'z', name: 'Z', slug: 'zeta' } });
    const old = sub({ id: 'old', status: 'rejected', decidedAt: '2026-01-01T10:00:00Z', club: { id: 'z', name: 'Z', slug: 'zeta' } });
    const { decided } = selectApplicationStatus([...many, other, old], NOW);
    expect(decided.map((d) => d.id)).toEqual(['d4', 'd3', 'd2', 'o']);
  });
});

describe('findOpenDraft', () => {
  it('finds the newest draft of the same club and mode only', () => {
    const mine = [
      sub({ id: 'old', createdAt: '2026-09-01T10:00:00Z' }),
      sub({ id: 'new', createdAt: '2026-10-02T10:00:00Z' }),
      sub({ id: 'child', onBehalfOf: 'guardian' }),
      sub({ id: 'other', club: { id: 'z', name: 'Z', slug: 'zeta' } }),
      sub({ id: 'sent', status: 'submitted' }),
    ];
    expect(findOpenDraft(mine, 'demo', 'self')?.id).toBe('new');
    expect(findOpenDraft(mine, 'demo', 'guardian')?.id).toBe('child');
    expect(findOpenDraft(mine, 'nope', 'self')).toBeUndefined();
  });
});

describe('normalizeClubSlug', () => {
  it('lower-cases and rejects non code-like values', () => {
    expect(normalizeClubSlug('  Demo-Verein ')).toBe('demo-verein');
    expect(normalizeClubSlug('')).toBeNull();
    expect(normalizeClubSlug(null)).toBeNull();
    expect(normalizeClubSlug('a b')).toBeNull();
    expect(normalizeClubSlug('-x')).toBeNull();
  });
});

describe('formatBerlinDate', () => {
  it('uses the Berlin calendar day', () => {
    expect(formatBerlinDate('2026-10-16T23:30:00Z', 'de')).toBe('17.10.2026');
    expect(formatBerlinDate('garbage', 'de')).toBe('');
  });
});
