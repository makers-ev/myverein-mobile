import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useEventHelpers } from './useEventHelpers';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const plan = { eventId: 'e1', cancelled: false, canManage: false, stations: [], mine: [] };

beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({ data: plan }));

describe('useEventHelpers', () => {
  it('loads the plan and does nothing without an event', async () => {
    const { result, rerender } = await renderHook(({ id }: { id: string | null }) => useEventHelpers('club', id), { initialProps: { id: null as string | null } });
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    await rerender({ id: 'e1' });
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/events/e1/helpers?clubId=club');
    expect(result.current.data).toEqual(plan);
  });

  it('signs up for a ward, withdraws, offers and accepts swaps and re-reads the plan', async () => {
    const { result } = await renderHook(() => useEventHelpers('club', 'e1'));
    await act(async () => {});
    await act(async () => {
      await result.current.signUp('s1', 'w1');
      await result.current.signUp('s1', null);
      await result.current.withdraw('s1', 'w1');
      await result.current.offerSwap('s1', null, 'c2');
      await result.current.acceptSwap('sw1', null);
      await result.current.declineSwap('sw1', 'w1');
      await result.current.withdrawSwap('sw1');
    });
    const calls = apiFetchMock.mock.calls.map((c) => [c[0], c[1]]);
    expect(calls).toContainEqual(['/events/e1/helpers/shifts/s1/signup?clubId=club', { method: 'POST', body: { clubMemberId: 'w1' } }]);
    expect(calls).toContainEqual(['/events/e1/helpers/shifts/s1/signup?clubId=club', { method: 'POST', body: {} }]);
    expect(calls).toContainEqual(['/events/e1/helpers/shifts/s1/signup?clubId=club&clubMemberId=w1', { method: 'DELETE' }]);
    expect(calls).toContainEqual(['/events/e1/helpers/shifts/s1/swaps?clubId=club', { method: 'POST', body: { toClubMemberId: 'c2' } }]);
    expect(calls).toContainEqual(['/events/e1/helpers/swaps/sw1/accept?clubId=club', { method: 'POST', body: {} }]);
    expect(calls).toContainEqual(['/events/e1/helpers/swaps/sw1/decline?clubId=club', { method: 'POST', body: { clubMemberId: 'w1' } }]);
    expect(calls).toContainEqual(['/events/e1/helpers/swaps/sw1?clubId=club', { method: 'DELETE' }]);
    // every action re-reads the plan
    expect(apiFetchMock.mock.calls.filter((c) => c[0] === '/events/e1/helpers?clubId=club').length).toBeGreaterThanOrEqual(8);
  });

  it('lets a failed action propagate so the sheet can explain it', async () => {
    const { result } = await renderHook(() => useEventHelpers('club', 'e1'));
    await act(async () => {});
    apiFetchMock.mockRejectedValueOnce(new Error('boom'));
    await expect(result.current.signUp('s1', null)).rejects.toThrow('boom');
  });
});
