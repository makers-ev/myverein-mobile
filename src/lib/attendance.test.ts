import {
  applyChange,
  applyPending,
  buildPutBody,
  cleanGuestName,
  isRetryableStatus,
  itemForKey,
  markAllPresentChanges,
  retryDelayMs,
  summarize,
  supervisorCandidates,
  toggleStatus,
  toggleSupervisor,
  type AttendanceEntry,
  type AttendanceView,
} from './attendance';

const entry = (over: Partial<AttendanceEntry>): AttendanceEntry => ({
  key: 'm:1',
  attendanceId: null,
  clubMemberId: '1',
  guestName: null,
  displayName: 'Anna',
  status: null,
  source: null,
  prefilled: false,
  rsvp: null,
  onRoster: true,
  isMinor: false,
  hasAccount: true,
  ...over,
});

const view = (entries: AttendanceEntry[]): AttendanceView => ({
  eventId: 'e',
  tracking: true,
  closed: false,
  closedAt: null,
  canWrite: true,
  supervisors: [],
  entries,
  summary: summarize(entries),
  supervisionWarning: false,
  minorsPresent: 0,
  corrections: [],
});

describe('attendance helpers', () => {
  it('summarizes statuses and open entries', () => {
    expect(summarize([entry({ status: 'anwesend' }), entry({ key: 'm:2', status: 'entschuldigt' }), entry({ key: 'm:3' })])).toEqual({
      anwesend: 1,
      entschuldigt: 1,
      unentschuldigt: 0,
      offen: 1,
    });
  });

  it('toggles back to open when the same status is tapped again', () => {
    expect(toggleStatus(null, 'anwesend')).toBe('anwesend');
    expect(toggleStatus('anwesend', 'anwesend')).toBeNull();
    expect(toggleStatus('anwesend', 'unentschuldigt')).toBe('unentschuldigt');
  });

  it('applies a change locally, drops the prefill flag and recomputes the summary', () => {
    const v = view([entry({ status: 'entschuldigt', source: 'meldung', prefilled: true })]);
    const next = applyChange(v, 'm:1', 'anwesend');
    expect(next.entries[0]).toMatchObject({ status: 'anwesend', source: 'manuell', prefilled: false });
    expect(next.summary.anwesend).toBe(1);
    expect(v.entries[0].status).toBe('entschuldigt');
  });

  it('removes a guest that is set back to open but keeps members on the list', () => {
    const v = view([entry({ key: 'g:9', clubMemberId: null, attendanceId: '9', guestName: 'Max', status: 'anwesend' }), entry({ status: 'anwesend' })]);
    expect(applyChange(v, 'g:9', null).entries.map((e) => e.key)).toEqual(['m:1']);
    expect(applyChange(v, 'm:1', null).entries.map((e) => e.key)).toEqual(['g:9', 'm:1']);
  });

  it('lays unconfirmed changes over a server view', () => {
    const server = view([entry({ status: null }), entry({ key: 'm:2', status: null })]);
    const merged = applyPending(server, new Map([['m:1', 'anwesend' as const], ['m:gone', 'anwesend' as const]]));
    expect(merged.entries.map((e) => e.status)).toEqual(['anwesend', null]);
  });

  it('marks only open people as present', () => {
    const v = view([entry({ status: null }), entry({ key: 'm:2', status: 'entschuldigt' }), entry({ key: 'm:3', status: null })]);
    expect(markAllPresentChanges(v)).toEqual([
      { key: 'm:1', status: 'anwesend' },
      { key: 'm:3', status: 'anwesend' },
    ]);
  });

  it('builds the batch body with member and attendance ids and a trimmed reason', () => {
    const body = buildPutBody(new Map([['m:1', 'anwesend' as const], ['g:7', null], ['x:bad', 'anwesend' as const]]), '  zu spät  ');
    expect(body).toEqual({ entries: [{ clubMemberId: '1', status: 'anwesend' }, { attendanceId: '7', status: null }], reason: 'zu spät' });
    expect(buildPutBody(new Map(), null)).toBeNull();
    expect(buildPutBody(new Map([['m:1', 'anwesend' as const]]), '   ')).toEqual({ entries: [{ clubMemberId: '1', status: 'anwesend' }] });
    expect(itemForKey('m:', 'anwesend')).toBeNull();
  });

  it('retries only network-like failures with a capped growing delay', () => {
    expect(isRetryableStatus(null)).toBe(true);
    expect(isRetryableStatus(0)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(409)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
    expect([0, 1, 2, 10].map(retryDelayMs)).toEqual([3000, 6000, 12000, 30000]);
  });

  it('offers adults with a member id as supervisors and toggles them (max 20)', () => {
    const v = view([entry({}), entry({ key: 'm:2', clubMemberId: '2', isMinor: true }), entry({ key: 'g:3', clubMemberId: null, guestName: 'Gast' })]);
    expect(supervisorCandidates(v)).toEqual([{ clubMemberId: '1', displayName: 'Anna' }]);
    expect(toggleSupervisor(['1'], '2')).toEqual(['1', '2']);
    expect(toggleSupervisor(['1', '2'], '1')).toEqual(['2']);
    expect(toggleSupervisor(Array.from({ length: 20 }, (_, i) => String(i)), 'x')).toHaveLength(20);
  });

  it('cleans guest names', () => {
    expect(cleanGuestName('  Max   Muster ')).toBe('Max Muster');
    expect(cleanGuestName('   ')).toBeNull();
  });
});
