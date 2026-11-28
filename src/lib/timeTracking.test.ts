jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';
import { endTimeErrorKey, endTimeProblem, entryMarks, isStuck, latestEnd, needsEndTime, runningState, canDeleteEntry, elapsedMinutes, formatDuration, monthBounds, shiftMonth, timeErrorKey, totalMinutes } from './timeTracking';

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

  it('classifies running time: normal, stale from 8 h, too long above 16 h', () => {
    expect(runningState(479)).toBe('ok');
    expect(runningState(480)).toBe('stale');
    expect(runningState(960)).toBe('stale');
    expect(runningState(961)).toBe('too-long');
    expect(runningState(328 * 60)).toBe('too-long');
  });

  it('maps needs_end_time and flags it', () => {
    const e = (status: number, code: string) => new ApiError(status, 'X', 'english', { code });
    expect(needsEndTime(e(409, 'needs_end_time'))).toBe(true);
    expect(needsEndTime(e(409, 'already_running'))).toBe(false);
    expect(timeErrorKey(e(409, 'needs_end_time'))).toBe('time.err.needs-end');
    expect(timeErrorKey(e(422, 'invalid_time'))).toBe('time.err.invalid');
    expect(timeErrorKey(e(422, 'in_future'))).toBe('time.err.future');
    expect(timeErrorKey(e(409, 'entry_overlap'))).toBe('time.err.overlap');
    expect(endTimeErrorKey(e(422, 'too_long'))).toBe('time.err.end-too-long');
  });

  it('bounds the end between start and min(now, start + 16 h)', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    const entry = { startedAt: '2026-06-01T08:00:00Z', maxEndedAt: '2026-06-01T24:00:00Z'.replace('24:00', '23:59') };
    expect(endTimeProblem(entry, new Date('2026-06-01T08:00:00Z'), now)).toBe('order');
    expect(endTimeProblem(entry, new Date('2026-06-01T12:00:00Z'), now)).toBeNull();
    expect(endTimeProblem(entry, new Date('2026-06-02T08:30:00Z'), now)).toBe('long');
    expect(endTimeProblem({ startedAt: '2026-06-10T11:00:00Z' }, new Date('2026-06-10T13:00:00Z'), now)).toBe('future');
    expect(latestEnd({ startedAt: '2026-06-10T11:00:00Z' }, now)).toBe(now.getTime());
    expect(latestEnd({ startedAt: '2026-06-01T08:00:00Z' }, now)).toBe(new Date('2026-06-02T00:00:00Z').getTime());
  });

  it('knows stuck entries from the server flag or the running time', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    expect(isStuck({ running: true, overdue: true, startedAt: '2026-06-10T11:00:00Z' }, now)).toBe(true);
    expect(isStuck({ running: true, startedAt: '2026-06-09T12:00:00Z' }, now)).toBe(true);
    expect(isStuck({ running: true, overdue: false, startedAt: '2026-06-10T11:00:00Z' }, now)).toBe(false);
    expect(isStuck({ running: false, overdue: true, startedAt: '2026-06-01T11:00:00Z' }, now)).toBe(false);
  });

  it('marks corrected, auto-closed and lead-closed entries', () => {
    expect(entryMarks({})).toEqual([]);
    expect(entryMarks({ corrected: true })).toEqual(['corrected']);
    expect(entryMarks({ corrected: true, autoClosed: true })).toEqual(['autoClosed']);
    expect(entryMarks({ corrected: true, closedByOther: true })).toEqual(['closedByOther']);
  });
});
