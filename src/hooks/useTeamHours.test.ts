import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useMyHours } from './useMyHours';
import { useTeamHours } from './useTeamHours';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;
const JUNE = new Date(2026, 5, 1);

beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({ data: [] }));

describe('useMyHours', () => {
  it('stays idle while disabled and reads the own month once enabled', async () => {
    const { rerender } = await renderHook(({ on }: { on: boolean }) => useMyHours('club', on, JUNE), { initialProps: { on: false } });
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    await rerender({ on: true });
    await act(async () => {});
    expect(apiFetchMock.mock.calls.map((c) => c[0])).toEqual(['/time-entries?clubId=club&scope=mine&from=2026-06-01&to=2026-06-30']);
  });
});

describe('useTeamHours', () => {
  it('reads /time-report for the month and exposes people and totals', async () => {
    apiFetchMock.mockResolvedValue({ data: { people: [{ clubMemberId: 'm1', displayName: 'Anna', entries: 2, minutes: 90, hours: 1.5 }], totals: { minutes: 90, hours: 1.5, amountCents: null } } });
    const { result } = await renderHook(() => useTeamHours('club', true, JUNE));
    await act(async () => {});
    expect(apiFetchMock.mock.calls[0]![0]).toBe('/time-report?clubId=club&from=2026-06-01&to=2026-06-30&groupBy=person');
    expect(result.current.report?.people[0]?.displayName).toBe('Anna');
  });

  it('keeps the error when the report is forbidden', async () => {
    apiFetchMock.mockRejectedValue(new Error('x'));
    const { result } = await renderHook(() => useTeamHours('club', true, JUNE));
    await act(async () => {});
    expect(result.current.report).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
