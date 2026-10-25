import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import type { AttendanceEntry, AttendanceView } from '@/lib/attendance';
import { summarize } from '@/lib/attendance';
import { useEventAttendance } from './useEventAttendance';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const entry = (id: string, status: AttendanceEntry['status'] = null): AttendanceEntry => ({
  key: `m:${id}`,
  attendanceId: null,
  clubMemberId: id,
  guestName: null,
  displayName: `P${id}`,
  status,
  source: null,
  prefilled: false,
  rsvp: null,
  onRoster: true,
  isMinor: false,
  hasAccount: true,
});
const make = (entries: AttendanceEntry[], over: Partial<AttendanceView> = {}): AttendanceView => ({
  eventId: 'e1',
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
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers();
  apiFetchMock.mockReset();
});
afterEach(() => jest.useRealTimers());

async function mountLoaded(initial: AttendanceView) {
  apiFetchMock.mockResolvedValueOnce({ data: initial });
  const hook = await renderHook(() => useEventAttendance('club', 'e1'));
  await act(async () => {});
  return hook;
}

describe('useEventAttendance', () => {
  it('applies taps locally and sends them as ONE batch after the debounce', async () => {
    const { result } = await mountLoaded(make([entry('1'), entry('2')]));
    apiFetchMock.mockResolvedValue({ data: make([entry('1', 'anwesend'), entry('2', 'unentschuldigt')]) });
    await act(async () => {
      result.current.setStatus('m:1', 'anwesend');
      result.current.setStatus('m:2', 'unentschuldigt');
    });
    expect(result.current.view?.entries.map((e) => e.status)).toEqual(['anwesend', 'unentschuldigt']);
    expect(result.current.unsent).toBe(2);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    const puts = apiFetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0][1].body).toEqual({
      entries: [{ clubMemberId: '1', status: 'anwesend' }, { clubMemberId: '2', status: 'unentschuldigt' }],
    });
    expect(result.current.unsent).toBe(0);
  });

  it('keeps the taps after a network failure and re-sends them automatically', async () => {
    const { result } = await mountLoaded(make([entry('1')]));
    apiFetchMock.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    await act(async () => {
      result.current.setStatus('m:1', 'anwesend');
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current.problem).toBe('network');
    expect(result.current.unsent).toBe(1);
    expect(result.current.view?.entries[0].status).toBe('anwesend');

    apiFetchMock.mockResolvedValue({ data: make([entry('1', 'anwesend')]) });
    await act(async () => {
      jest.advanceTimersByTime(3100);
    });
    expect(result.current.problem).toBeNull();
    expect(result.current.unsent).toBe(0);
    expect(apiFetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT')).toHaveLength(2);
  });

  it('does not let a server answer undo a tap made while the request was in flight', async () => {
    const { result } = await mountLoaded(make([entry('1'), entry('2')]));
    let release: (v: unknown) => void = () => {};
    apiFetchMock.mockImplementationOnce(() => new Promise((r) => (release = r)));
    await act(async () => {
      result.current.setStatus('m:1', 'anwesend');
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      result.current.setStatus('m:2', 'anwesend');
    });
    apiFetchMock.mockResolvedValue({ data: make([entry('1', 'anwesend'), entry('2', 'anwesend')]) });
    await act(async () => {
      release({ data: make([entry('1', 'anwesend'), entry('2')]) });
    });
    expect(result.current.view?.entries.map((e) => e.status)).toEqual(['anwesend', 'anwesend']);
  });

  it('drops rejected changes and reloads the real state', async () => {
    const { result } = await mountLoaded(make([entry('1')]));
    apiFetchMock
      .mockRejectedValueOnce(new ApiError(422, 'VALIDATION_ERROR', 'x', { code: 'unknown_member' }))
      .mockResolvedValue({ data: make([entry('1')]) });
    await act(async () => {
      result.current.setStatus('m:1', 'anwesend');
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current.problem).toBe('rejected');
    expect(result.current.unsent).toBe(0);
    expect(result.current.view?.entries[0].status).toBeNull();
  });

  it('holds the taps of a closed list until a reason is entered', async () => {
    const { result } = await mountLoaded(make([entry('1')], { closed: true }));
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'x', { code: 'reason_required' }));
    await act(async () => {
      result.current.setStatus('m:1', 'anwesend');
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current.problem).toBe('reason_required');
    expect(result.current.unsent).toBe(1);
    apiFetchMock.mockResolvedValue({ data: make([entry('1', 'anwesend')], { closed: true }) });
    await act(async () => {
      result.current.setReason('Nachgetragen');
      jest.advanceTimersByTime(10);
    });
    const last = apiFetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT').pop();
    expect(last?.[1].body.reason).toBe('Nachgetragen');
    expect(result.current.problem).toBeNull();
  });

  it('ignores taps when the caller cannot write', async () => {
    const { result } = await mountLoaded(make([entry('1')], { canWrite: false }));
    await act(async () => {
      result.current.setStatus('m:1', 'anwesend');
    });
    expect(result.current.unsent).toBe(0);
    expect(result.current.view?.entries[0].status).toBeNull();
  });

  it('marks all open people present in one batch', async () => {
    const { result } = await mountLoaded(make([entry('1'), entry('2', 'entschuldigt')]));
    apiFetchMock.mockResolvedValue({ data: make([entry('1', 'anwesend'), entry('2', 'entschuldigt')]) });
    await act(async () => {
      result.current.markAllPresent();
    });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    const put = apiFetchMock.mock.calls.find((c) => c[1]?.method === 'PUT');
    expect(put?.[1].body.entries).toEqual([{ clubMemberId: '1', status: 'anwesend' }]);
  });
});
