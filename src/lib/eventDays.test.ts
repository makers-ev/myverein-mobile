import { allDayRange, eventDayKeys, formatEventRange, isMultiDay } from './eventDays';

const iso = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).toISOString();

describe('eventDayKeys', () => {
  it('returns one day for a single event and for an event without end', () => {
    expect(eventDayKeys({ startsAt: iso(2026, 5, 12, 18), endsAt: iso(2026, 5, 12, 20) })).toEqual(['2026-05-12']);
    expect(eventDayKeys({ startsAt: iso(2026, 5, 12, 18), endsAt: null })).toEqual(['2026-05-12']);
  });

  it('lists every day of a multi-day event, across a month change', () => {
    const keys = eventDayKeys({ startsAt: iso(2026, 5, 30, 18), endsAt: iso(2026, 6, 2, 10) });
    expect(keys).toEqual(['2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02']);
  });

  it('uses the local date of endsAt as the last day of an all-day event', () => {
    const keys = eventDayKeys({ startsAt: iso(2026, 5, 12), endsAt: iso(2026, 5, 14, 23, 59, 59), allDay: true });
    expect(keys).toEqual(['2026-05-12', '2026-05-13', '2026-05-14']);
    expect(eventDayKeys({ startsAt: iso(2026, 5, 12), endsAt: iso(2026, 5, 12, 23, 59, 59), allDay: true })).toEqual(['2026-05-12']);
  });

  it('does not claim the next day for a timed event ending exactly at midnight', () => {
    expect(eventDayKeys({ startsAt: iso(2026, 5, 12, 20), endsAt: iso(2026, 5, 13, 0) })).toEqual(['2026-05-12']);
  });

  it('survives an end before the start and invalid dates', () => {
    expect(eventDayKeys({ startsAt: iso(2026, 5, 12, 20), endsAt: iso(2026, 5, 10, 0) })).toEqual(['2026-05-12']);
    expect(eventDayKeys({ startsAt: 'nope', endsAt: null })).toEqual([]);
  });

  it('caps absurd spans', () => {
    expect(eventDayKeys({ startsAt: iso(2026, 1, 1, 8), endsAt: iso(2030, 1, 1, 8) }).length).toBe(366);
  });
});

describe('formatEventRange', () => {
  it('shows only the label for a one-day all-day event and no time for a multi-day one', () => {
    expect(formatEventRange({ startsAt: iso(2026, 5, 12), endsAt: iso(2026, 5, 12, 23, 59, 59), allDay: true }, 'de', 'Ganztägig')).toBe('Ganztägig');
    const range = formatEventRange({ startsAt: iso(2026, 5, 12), endsAt: iso(2026, 5, 14, 23, 59, 59), allDay: true }, 'de', 'Ganztägig');
    expect(range).toContain('–');
    expect(range).not.toMatch(/\d:\d\d/);
  });

  it('shows date and time on both ends of a timed multi-day event', () => {
    expect(isMultiDay({ startsAt: iso(2026, 5, 12, 18), endsAt: iso(2026, 5, 13, 12) })).toBe(true);
    expect(formatEventRange({ startsAt: iso(2026, 5, 12, 18), endsAt: iso(2026, 5, 13, 12) }, 'de', 'x')).toMatch(/18:00.*–.*12:00/);
  });

  it('keeps the plain time range for same-day events', () => {
    expect(formatEventRange({ startsAt: iso(2026, 5, 12, 18), endsAt: iso(2026, 5, 12, 20) }, 'de', 'x')).toBe('18:00 – 20:00');
  });
});

describe('allDayRange', () => {
  it('spans local midnight to 23:59:59 of the last day', () => {
    const r = allDayRange(new Date(2026, 4, 12, 18), new Date(2026, 4, 14, 9));
    expect(new Date(r.startsAt).getTime()).toBe(new Date(2026, 4, 12).getTime());
    expect(new Date(r.endsAt).getTime()).toBe(new Date(2026, 4, 14, 23, 59, 59).getTime());
  });

  it('uses the start day when there is no end or the end is earlier', () => {
    const one = allDayRange(new Date(2026, 4, 12, 18), null);
    expect(new Date(one.endsAt).getTime()).toBe(new Date(2026, 4, 12, 23, 59, 59).getTime());
    const back = allDayRange(new Date(2026, 4, 12), new Date(2026, 4, 10));
    expect(new Date(back.endsAt).getTime()).toBe(new Date(2026, 4, 12, 23, 59, 59).getTime());
  });
});
