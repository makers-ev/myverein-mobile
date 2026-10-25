import {
  affectedSignups,
  createSeriesBody,
  defaultRecurrence,
  deleteSeriesQuery,
  draftFromSeries,
  patchSeriesBody,
  recurrenceProblem,
  setPosOf,
  weekdayOf,
  type EventSeries,
  type SeriesTemplate,
} from './eventSeries';

const template = (over: Partial<SeriesTemplate> = {}): SeriesTemplate => ({
  calendarId: 'cal',
  title: 'Training',
  description: null,
  category: null,
  capacity: null,
  allDay: false,
  startsAt: new Date(2026, 4, 12, 18, 0), // Tuesday
  endsAt: new Date(2026, 4, 12, 19, 30),
  ...over,
});

describe('date helpers', () => {
  it('maps weekdays Monday-first and the n-th weekday of the month', () => {
    expect(weekdayOf(new Date(2026, 4, 12))).toBe('TU');
    expect(weekdayOf(new Date(2026, 4, 17))).toBe('SU');
    expect(setPosOf(new Date(2026, 4, 12))).toBe(2);
    expect(setPosOf(new Date(2026, 4, 29))).toBe(-1);
  });
});

describe('recurrenceProblem', () => {
  const start = new Date(2026, 4, 12, 18);
  it('accepts "does not repeat" and a plain weekly rule', () => {
    expect(recurrenceProblem(defaultRecurrence(start), start)).toBeNull();
    expect(recurrenceProblem({ ...defaultRecurrence(start), freq: 'weekly' }, start)).toBeNull();
  });

  it('rejects bad interval, no weekday, missing/early until and bad count', () => {
    const weekly = { ...defaultRecurrence(start), freq: 'weekly' as const };
    expect(recurrenceProblem({ ...weekly, interval: '0' }, start)).toBe('series.error.interval');
    expect(recurrenceProblem({ ...weekly, byDay: [] }, start)).toBe('series.error.weekdays');
    expect(recurrenceProblem({ ...weekly, end: 'until' }, start)).toBe('series.error.until-missing');
    expect(recurrenceProblem({ ...weekly, end: 'until', untilDate: new Date(2026, 4, 1) }, start)).toBe('series.error.until-before-start');
    expect(recurrenceProblem({ ...weekly, end: 'count', count: '1001' }, start)).toBe('series.error.count');
  });
});

describe('createSeriesBody', () => {
  it('builds a weekly timed series with duration and no empty optionals', () => {
    const draft = { ...defaultRecurrence(template().startsAt), freq: 'weekly' as const, byDay: ['TH', 'TU'] as const, end: 'count' as const, count: '12' };
    const body = createSeriesBody(template(), { ...draft, byDay: [...draft.byDay] });
    expect(body).toEqual({
      calendarId: 'cal',
      title: 'Training',
      allDay: false,
      startDate: '2026-05-12',
      startTime: '18:00',
      durationMinutes: 90,
      freq: 'weekly',
      interval: 1,
      skipHolidays: false,
      byDay: ['TU', 'TH'],
      count: 12,
    });
  });

  it('builds an all-day monthly "n-th weekday" series with durationDays and until', () => {
    const t = template({ allDay: true, endsAt: new Date(2026, 4, 13, 23, 59, 59) });
    const draft = { ...defaultRecurrence(t.startsAt), freq: 'monthly' as const, monthlyMode: 'nth' as const, end: 'until' as const, untilDate: new Date(2026, 11, 31), skipHolidays: true };
    const body = createSeriesBody(t, draft);
    expect(body).toMatchObject({ allDay: true, startDate: '2026-05-12', durationDays: 2, byDay: ['TU'], bySetPos: 2, untilDate: '2026-12-31', skipHolidays: true });
    expect(body).not.toHaveProperty('startTime');
    expect(body).not.toHaveProperty('count');
  });
});

describe('patchSeriesBody', () => {
  it('scope this sends absolute times and the occurrence id, notify only when off', () => {
    const body = patchSeriesBody('this', 'ev1', template(), null, { reason: ' Regen ', notify: false });
    expect(body).toMatchObject({ scope: 'this', eventId: 'ev1', reason: 'Regen', notify: false, title: 'Training' });
    expect(body.startsAt).toBe(new Date(2026, 4, 12, 18).toISOString());
    expect(body).not.toHaveProperty('startTime');
    expect(patchSeriesBody('this', 'ev1', template(), null)).not.toHaveProperty('notify');
  });

  it('scope all sends time of day, duration and cleared rule fields, no eventId', () => {
    const draft = { ...defaultRecurrence(template().startsAt), freq: 'weekly' as const };
    const body = patchSeriesBody('all', 'ev1', template(), draft);
    expect(body).toMatchObject({ scope: 'all', startTime: '18:00', durationMinutes: 90, freq: 'weekly', byDay: ['TU'], bySetPos: null, untilDate: null, count: null });
    expect(body).not.toHaveProperty('eventId');
    expect(body).not.toHaveProperty('startsAt');
  });

  it('scope this_and_following keeps the occurrence id and omits the rule without a draft', () => {
    const body = patchSeriesBody('this_and_following', 'ev1', template(), null);
    expect(body).toMatchObject({ scope: 'this_and_following', eventId: 'ev1', startTime: '18:00' });
    expect(body).not.toHaveProperty('freq');
  });
});

describe('deleteSeriesQuery', () => {
  it('adds eventId except for scope all, trims the reason and flags notify=false', () => {
    expect(deleteSeriesQuery('c', 'all', 'e')).toBe('clubId=c&scope=all');
    expect(deleteSeriesQuery('c', 'this', 'e', { reason: ' Regen ', notify: false })).toBe('clubId=c&scope=this&eventId=e&reason=Regen&notify=false');
  });
});

describe('draftFromSeries / affectedSignups', () => {
  it('restores the end rule and the monthly n-th weekday mode', () => {
    const series = {
      startDate: '2026-05-12', freq: 'monthly', intervalCount: 2, byDay: ['TU'], bySetPos: 2, untilDate: null, count: 6, skipHolidays: true,
    } as unknown as EventSeries;
    expect(draftFromSeries(series)).toMatchObject({ freq: 'monthly', interval: '2', monthlyMode: 'nth', bySetPos: 2, end: 'count', count: '6', skipHolidays: true });
  });

  it('sums attendees and waitlist', () => {
    expect(affectedSignups({ attendeeCount: 3, waitlistCount: 2 })).toBe(5);
    expect(affectedSignups({})).toBe(0);
  });
});
