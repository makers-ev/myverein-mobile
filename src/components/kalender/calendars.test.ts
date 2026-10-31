import type { Calendar } from '@/hooks/useCalendars';

import { defaultCalendarId, isLockedDefaultCalendar } from './calendars';

const cal = (id: string, isDefault = false): Calendar => ({
  id,
  clubId: 'c',
  departmentId: null,
  name: id,
  isDefault,
  icalImportUrl: null,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
});

describe('isLockedDefaultCalendar', () => {
  it('locks the default calendar only while it is the only one', () => {
    const only = cal('a', true);
    expect(isLockedDefaultCalendar(only, [only])).toBe(true);
    expect(isLockedDefaultCalendar(only, [only, cal('b')])).toBe(false);
    expect(isLockedDefaultCalendar(cal('b'), [cal('b')])).toBe(false);
  });
});

describe('defaultCalendarId', () => {
  it('prefers the default, falls back to the first, else null', () => {
    expect(defaultCalendarId([cal('a'), cal('b', true)])).toBe('b');
    expect(defaultCalendarId([cal('a'), cal('b')])).toBe('a');
    expect(defaultCalendarId([])).toBeNull();
  });
});
