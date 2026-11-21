jest.mock('./api', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return { ApiError };
});

import { ApiError } from './api';
import {
  assignmentPhase,
  canSearchClubs,
  canSeeSponsors,
  externalRoleOf,
  formatDay,
  groupSponsors,
  isClubSuspendedError,
  normalizeSearchQuery,
  parseAssignments,
  parseClubHits,
  parseSponsors,
  safeWebLink,
} from './outreach';

describe('externalRoleOf', () => {
  it('reads an explicit role or an orgRole token', () => {
    expect(externalRoleOf({ orgRole: 'guest', externalRole: 'sponsor' })).toBe('sponsor');
    expect(externalRoleOf({ orgRole: 'guest, dienstleister' })).toBe('dienstleister');
  });
  it('is null for members, guardians and unknown values (deny by default)', () => {
    expect(externalRoleOf({ orgRole: 'member' })).toBeNull();
    expect(externalRoleOf({ orgRole: 'guest' })).toBeNull();
    expect(externalRoleOf({ orgRole: 'owner', externalRole: 'admin' })).toBeNull();
    expect(externalRoleOf(null)).toBeNull();
  });
});

describe('sponsors', () => {
  const raw = (over: Record<string, unknown>) => ({ id: 's1', name: 'Bäckerei Frei', status: 'aktiv', visibility: 'intern', ...over });

  it('parses the envelope, drops malformed rows and keeps date strings', () => {
    const list = parseSponsors({ data: [raw({ endsOn: '2026-12-31', contacts: [{ id: 'c1', name: 'Anna', isPrimary: true }, { nope: 1 }] }), { id: 1 }, null] });
    expect(list).toHaveLength(1);
    expect(list![0]!.endsOn).toBe('2026-12-31');
    expect(list![0]!.contacts).toEqual([{ id: 'c1', name: 'Anna', role: null, email: null, phone: null, isPrimary: true }]);
  });

  it('treats a malformed answer as an error and an unknown status as active', () => {
    expect(parseSponsors({ data: 'x' })).toBeNull();
    expect(parseSponsors([raw({ status: 'kaputt' })])![0]!.status).toBe('aktiv');
  });

  it('groups expiring first and skips empty groups', () => {
    const list = parseSponsors([
      raw({ id: 'a', status: 'abgelaufen' }),
      raw({ id: 'b', expiringSoon: true, daysLeft: 10 }),
      raw({ id: 'c' }),
    ])!;
    expect(groupSponsors(list).map((g) => [g.group, g.items.map((i) => i.id)])).toEqual([
      ['expiring', ['b']],
      ['active', ['c']],
      ['expired', ['a']],
    ]);
  });

  it('allows the list only with a sponsors permission', () => {
    expect(canSeeSponsors(() => false)).toBe(false);
    expect(canSeeSponsors((p) => p === 'sponsors:read')).toBe(true);
  });

  it('opens only http(s) links', () => {
    expect(safeWebLink('https://example.org/x')).toBe('https://example.org/x');
    expect(safeWebLink('javascript:alert(1)')).toBeNull();
    expect(safeWebLink(null)).toBeNull();
  });

  it('formats a day only when it is a valid key', () => {
    expect(formatDay('2026-03-05', 'de')).toBe(new Date(2026, 2, 5).toLocaleDateString('de'));
    expect(formatDay('05.03.2026', 'de')).toBeNull();
  });
});

describe('assignments', () => {
  const a = { validFrom: '2026-05-01T08:00:00.000Z', validUntil: '2026-05-01T18:00:00.000Z' };
  it('knows the window', () => {
    expect(assignmentPhase(a, Date.parse('2026-05-01T07:00:00Z'))).toBe('upcoming');
    expect(assignmentPhase(a, Date.parse('2026-05-01T12:00:00Z'))).toBe('active');
    expect(assignmentPhase(a, Date.parse('2026-05-02T00:00:00Z'))).toBe('over');
    expect(assignmentPhase({ validFrom: 'x', validUntil: 'y' }, 0)).toBe('over');
  });
  it('parses rows with and without location', () => {
    const list = parseAssignments({
      data: [
        { id: '1', title: 'Heizung warten', ...a, location: { id: 'l', name: 'Halle', accessNote: 'Seiteneingang' } },
        { id: '2', title: 'Ohne Ort', ...a },
        { id: '3' },
      ],
    })!;
    expect(list.map((x) => x.id)).toEqual(['1', '2']);
    expect(list[0]!.location?.accessNote).toBe('Seiteneingang');
    expect(list[1]!.location).toBeNull();
  });
});

describe('club search', () => {
  it('needs the minimum length after trimming', () => {
    expect(normalizeSearchQuery('  TSV   Ost ')).toBe('TSV Ost');
    expect(canSearchClubs('ab ')).toBe(false);
    expect(canSearchClubs(' TSV ')).toBe(true);
  });
  it('keeps only usable hits', () => {
    expect(parseClubHits({ data: [{ slug: 'tsv', name: 'TSV', city: 'Ulm', logoUrl: 'https://s/x' }, { slug: '', name: 'x' }, { name: 'y' }] })).toEqual([
      { slug: 'tsv', name: 'TSV', city: 'Ulm', logoUrl: 'https://s/x' },
    ]);
    expect(parseClubHits('nope')).toBeNull();
  });
  it('recognises a suspended club', () => {
    expect(isClubSuspendedError(new ApiError(403, 'CLUB_SUSPENDED', ''))).toBe(true);
    expect(isClubSuspendedError(new ApiError(423, 'X', '', { code: 'club_suspended' }))).toBe(true);
    expect(isClubSuspendedError(new ApiError(403, 'FORBIDDEN', ''))).toBe(false);
    expect(isClubSuspendedError(new Error('x'))).toBe(false);
  });
});
