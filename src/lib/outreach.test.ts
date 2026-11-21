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
  externalRolesOf,
  nextAssignmentBoundary,
  safeMailto,
  safeTel,
  parseAssignments,
  formatInstant,
  parseExternalMe,
  parsePublicClub,
  formatDay,
  groupSponsors,
  isClubSuspendedError,
  normalizeSearchQuery,
  parseClubHits,
  parseSponsors,
  safeWebLink,
} from './outreach';

describe('externalRoleOf', () => {
  it('needs externalOnly and prefers sponsor over dienstleister', () => {
    expect(externalRoleOf({ externalOnly: true, roleTypes: ['dienstleister'] })).toBe('dienstleister');
    expect(externalRoleOf({ externalOnly: true, roleTypes: ['dienstleister', 'sponsor'] })).toBe('sponsor');
    expect(externalRolesOf({ externalOnly: true, roleTypes: ['dienstleister', 'sponsor'] })).toEqual(['sponsor', 'dienstleister']);
  });
  it('is null for members, guardians and unknown values (deny by default)', () => {
    expect(externalRoleOf({ externalOnly: false, roleTypes: ['sponsor'] })).toBeNull();
    expect(externalRoleOf({ externalOnly: true, roleTypes: ['admin'] })).toBeNull();
    expect(externalRoleOf(null)).toBeNull();
  });
});

describe('parseExternalMe', () => {
  it('parses the self view with sponsors and assignments', () => {
    const me = parseExternalMe({
      data: {
        clubId: 'c1',
        clubName: 'TSV',
        clubSlug: 'tsv',
        externalOnly: true,
        roleTypes: ['sponsor'],
        sponsors: [{ id: 's', name: 'Bäckerei', status: 'aktiv', logoUrl: 'https://x/media/k?sig=1', contacts: [] }, { bad: 1 }],
        assignments: [{ id: 'a', title: 'Heizung', validFrom: '2026-05-01T08:00:00Z', validUntil: '2026-05-01T18:00:00Z', active: true, location: { id: 'l', name: 'Halle', address: 'Weg 1' } }],
      },
    }, Date.parse('2026-05-01T12:00:00Z'))!;
    expect(me.externalOnly).toBe(true);
    expect(me.sponsors.map((s) => s.name)).toEqual(['Bäckerei']);
    expect(me.assignments[0]!.location).toEqual({ id: 'l', name: 'Halle', address: 'Weg 1' });
  });
  it('keeps the role information when the club name is null on the wire', () => {
    const me = parseExternalMe({ data: { clubId: 'c', clubName: null, clubSlug: null, externalOnly: true, roleTypes: ['sponsor'], sponsors: [], assignments: [] } })!;
    expect(me.clubName).toBe('');
    expect(externalRoleOf(me)).toBe('sponsor');
  });
  it('rejects a malformed answer', () => {
    expect(parseExternalMe({ data: { clubId: 1 } })).toBeNull();
    expect(parseExternalMe('x')).toBeNull();
  });
});

describe('parsePublicClub', () => {
  it('reads the released fields and skips cancelled events', () => {
    const c = parsePublicClub({
      data: { name: 'TSV', tagline: 'Sport', contact: { email: 'a@b.de', phone: null }, events: [{ title: 'Fest', startsAt: '2026-06-01T10:00:00Z', locationName: 'Halle' }, { title: 'Weg', startsAt: '2026-06-02T10:00:00Z', cancelled: true }] },
    })!;
    expect(c.contactEmail).toBe('a@b.de');
    expect(c.events.map((e) => e.title)).toEqual(['Fest']);
    expect(parsePublicClub({ data: {} })).toBeNull();
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
  it('judges the window by the local clock: a server active flag never extends it', () => {
    expect(assignmentPhase(a, Date.parse('2026-05-01T07:00:00Z'))).toBe('upcoming');
    expect(assignmentPhase(a, Date.parse('2026-05-01T12:00:00Z'))).toBe('active');
    expect(assignmentPhase(a, Date.parse('2026-05-02T00:00:00Z'))).toBe('over');
    expect(assignmentPhase({ ...a, active: true }, Date.parse('2026-05-02T00:00:00Z'))).toBe('over');
    expect(assignmentPhase({ ...a, active: true }, Date.parse('2026-05-01T07:00:00Z'))).toBe('upcoming');
    expect(assignmentPhase({ ...a, active: false }, Date.parse('2026-05-01T12:00:00Z'))).toBe('over');
    expect(assignmentPhase({ validFrom: 'x', validUntil: 'y' }, 0)).toBe('over');
  });
  it('finds the next boundary so the screen can re-judge when a window opens or closes', () => {
    const now = Date.parse('2026-05-01T12:00:00Z');
    expect(nextAssignmentBoundary([a], now)).toBe(Date.parse(a.validUntil));
    expect(nextAssignmentBoundary([a, { validFrom: '2026-05-01T13:00:00Z', validUntil: '2026-05-01T20:00:00Z' }], now)).toBe(Date.parse('2026-05-01T13:00:00Z'));
    expect(nextAssignmentBoundary([a], Date.parse('2026-05-03T00:00:00Z'))).toBeNull();
  });
  it('never takes place/address/note of a window that is not open into the state, whatever the server sends', () => {
    const row = (id: string, from: string, until: string) => ({ id, title: id, note: 'Code 1234', validFrom: from, validUntil: until, active: true, location: { id: 'l', name: 'Halle', address: 'Weg 1' } });
    const now = Date.parse('2026-05-01T12:00:00Z');
    const list = parseAssignments([row('now', '2026-05-01T08:00:00Z', '2026-05-01T18:00:00Z'), row('later', '2026-05-02T08:00:00Z', '2026-05-02T18:00:00Z'), row('past', '2026-04-01T08:00:00Z', '2026-04-01T18:00:00Z')], now);
    expect(list.map((x) => x.id)).toEqual(['now', 'later']);
    expect(list[0]!.note).toBe('Code 1234');
    expect(list[0]!.location?.name).toBe('Halle');
    expect(list[1]!.note).toBeNull();
    expect(list[1]!.location).toBeNull();
  });
  it('formats an instant only when it is a date', () => {
    expect(formatInstant('nope', 'de')).toBeNull();
    expect(formatInstant('2026-05-01T08:00:00Z', 'de')).toContain(',');
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

describe('contact links', () => {
  it('opens mail/phone only for clean values', () => {
    expect(safeMailto('anna@example.org')).toBe('mailto:anna@example.org');
    expect(safeMailto('a@b.de?cc=x@y.de')).toBeNull();
    expect(safeMailto('a b@c.de')).toBeNull();
    expect(safeTel('+49 (0)731 123-45')).toBe('tel:+49073112345');
    expect(safeTel('0731/12345')).toBe('tel:073112345');
    expect(safeTel('12; rm')).toBeNull();
    expect(safeTel(null)).toBeNull();
  });
});
