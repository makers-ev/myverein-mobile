import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useTimeTracking } from './useTimeTracking';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;
const NOW = new Date(2026, 5, 10, 12, 0, 0);

beforeEach(() =>
  apiFetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith('/time-entries/current')) return { data: null };
    return { data: [] };
  }),
);

describe('useTimeTracking', () => {
  it('stays idle while disabled and loads current entry, month and proposals once enabled', async () => {
    const { result, rerender } = await renderHook(({ on }: { on: boolean }) => useTimeTracking('club', on, NOW), { initialProps: { on: false } });
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    await rerender({ on: true });
    await act(async () => {});
    const paths = apiFetchMock.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/time-entries/current?clubId=club');
    expect(paths).toContain('/time-entries?clubId=club&scope=mine&from=2026-06-01&to=2026-06-30');
    expect(paths).toContain('/time-entries/suggestions?clubId=club&from=2026-06-01&to=2026-06-30');
    expect(result.current.current).toBeNull();
  });

  it('stamps in for an event, out, takes over a proposal and deletes - each re-reading', async () => {
    const { result } = await renderHook(() => useTimeTracking('club', true, NOW));
    await act(async () => {});
    await act(async () => {
      await result.current.clockIn('e1');
      await result.current.clockIn();
      await result.current.clockOut();
      await result.current.fromEvent('e2');
      await result.current.removeEntry('t1');
    });
    const calls = apiFetchMock.mock.calls.map((c) => [c[0], c[1]]);
    expect(calls).toContainEqual(['/time-entries/clock-in?clubId=club', { method: 'POST', body: { eventId: 'e1' } }]);
    expect(calls).toContainEqual(['/time-entries/clock-in?clubId=club', { method: 'POST', body: {} }]);
    expect(calls).toContainEqual(['/time-entries/clock-out?clubId=club', { method: 'POST', body: {} }]);
    expect(calls).toContainEqual(['/time-entries/from-event?clubId=club', { method: 'POST', body: { eventId: 'e2' } }]);
    expect(calls).toContainEqual(['/time-entries/t1?clubId=club', { method: 'DELETE' }]);
  });
});
