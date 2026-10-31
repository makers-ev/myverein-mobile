jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';
import { canDeleteEntry, elapsedMinutes, formatDuration, monthBounds, shiftMonth, timeErrorKey, totalMinutes } from './timeTracking';

describe('time tracking helpers', () => {
  it('formats durations as h:mm', () => {
    expect(formatDuration(90)).toBe('1:30 h');
    expect(formatDuration(5)).toBe('0:05 h');
    expect(formatDuration(-3)).toBe('0:00 h');
  });

  it('counts elapsed whole minutes and never goes negative', () => {
    const now = new Date('2026-06-01T10:30:45Z');
    expect(elapsedMinutes('2026-06-01T09:00:00Z', now)).toBe(90);
    expect(elapsedMinutes('2026-06-01T11:00:00Z', now)).toBe(0);
    expect(elapsedMinutes('garbage', now)).toBe(0);
  });

  it('returns the first and last day of the month', () => {
    expect(monthBounds(new Date(2026, 1, 15))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds(new Date(2028, 1, 3))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('sums minutes without rejected entries', () => {
    expect(
      totalMinutes([
        { minutes: 60, status: 'offen' },
        { minutes: 30, status: 'bestaetigt' },
        { minutes: 99, status: 'abgelehnt' },
        { minutes: null, status: 'offen' },
      ]),
    ).toBe(90);
  });

  it('only lets open finished entries be deleted', () => {
    expect(canDeleteEntry({ status: 'offen', running: false })).toBe(true);
    expect(canDeleteEntry({ status: 'offen', running: true })).toBe(false);
    expect(canDeleteEntry({ status: 'bestaetigt', running: false })).toBe(false);
  });

  it('maps stamp conflicts to plain-language keys', () => {
    const e = (status: number, code?: string) => new ApiError(status, 'X', 'english', code ? { code } : undefined);
    expect(timeErrorKey(e(409, 'already_running'))).toBe('time.err.running');
    expect(timeErrorKey(e(409, 'none_running'))).toBe('time.err.none-running');
    expect(timeErrorKey(e(409, 'entry_exists'))).toBe('time.err.exists');
    expect(timeErrorKey(e(403, 'no_rate'))).toBe('time.err.no-rate');
    expect(apiErrorKey(e(403, 'no_rate'))).toBe('time.err.no-rate');
    expect(timeErrorKey(e(422, 'report_too_large'))).toBe('time.err.report-too-large');
    expect(apiErrorKey(e(422, 'report_too_large'))).toBe('time.err.report-too-large');
    expect(timeErrorKey(e(422, 'too_long'))).toBe('time.err.too-long');
    expect(timeErrorKey(e(403))).toBe('time.err.not-allowed');
    expect(timeErrorKey(e(500))).toBe('api.error.server');
  });

  it('shifts months across year ends', () => {
    expect(shiftMonth(new Date(2026, 0, 15), -1)).toEqual(new Date(2025, 11, 1));
    expect(shiftMonth(new Date(2026, 11, 3), 1)).toEqual(new Date(2027, 0, 1));
  });
});
