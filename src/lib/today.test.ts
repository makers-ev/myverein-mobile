import { isTodayEmpty, parseSearch, parseToday, setupStepTarget } from './today';

describe('parseToday', () => {
  it('reads the contract shape and keeps board/setup null when absent', () => {
    const t = parseToday({
      generatedAt: '2026-10-29T08:00:00Z',
      openRsvps: [{ eventId: 'e1', title: 'Training', startsAt: '2026-10-30T17:00:00Z' }],
      cancelled: [],
      unreadAnnouncements: 3,
      dueReturns: [{ loanId: 'l1', itemName: 'Ball', dueAt: '2026-10-31T00:00:00Z' }],
      openBallots: 1,
    });
    expect(t.openRsvps).toHaveLength(1);
    expect(t.unreadAnnouncements).toBe(3);
    expect(t.board).toBeNull();
    expect(t.setup).toBeNull();
    expect(isTodayEmpty(t)).toBe(false);
  });

  it('survives garbage and unwraps a data envelope', () => {
    expect(isTodayEmpty(parseToday(null))).toBe(true);
    expect(parseToday({ data: { unreadAnnouncements: 2 } }).unreadAnnouncements).toBe(2);
    expect(parseToday({ openRsvps: [{ nope: 1 }, 'x'], unreadAnnouncements: -4 }).openRsvps).toEqual([]);
  });

  it('keeps only the board keys that were sent and hides a finished setup', () => {
    const t = parseToday({ board: { openApplications: 2, memberCount: 80 }, setup: { done: ['logo'], open: [] } });
    expect(t.board).toEqual({ openApplications: 2, openExits: undefined, maintenanceDue: undefined, memberCount: 80 });
    expect(t.setup).toBeNull();
    expect(isTodayEmpty(t)).toBe(false);
    expect(isTodayEmpty(parseToday({ board: { memberCount: 80 } }))).toBe(true);
  });

  it('maps setup steps to app destinations or null for web-only steps', () => {
    expect(setupStepTarget('calendar')?.route).toBe('Kalender');
    expect(setupStepTarget('logo')).toBeNull();
  });
});

describe('parseSearch', () => {
  it('omits groups the server left out and drops malformed rows', () => {
    const r = parseSearch({ events: [{ id: 'e', title: 'Fest', startsAt: 'x' }, { id: 1 }], documents: [], locations: [{ id: 'l', name: 'Halle' }] });
    expect(r.members).toBeUndefined();
    expect(r.events).toHaveLength(1);
    expect(r.locations[0]?.name).toBe('Halle');
    expect(parseSearch({ members: [{ id: 'm', name: 'Anna' }] }).members).toHaveLength(1);
  });
});
