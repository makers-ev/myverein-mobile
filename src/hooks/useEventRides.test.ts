import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useEventRides } from './useEventRides';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({ data: { eventId: 'e1', rides: [] } }));

describe('useEventRides', () => {
  it('offers, requests for a ward, decides and removes - re-reading the list each time', async () => {
    const { result } = await renderHook(() => useEventRides('club', 'e1'));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/events/e1/rides?clubId=club');
    await act(async () => {
      await result.current.offer({ seats: 3, departurePlace: 'Platz' });
      await result.current.requestSeat('r1', 'kid');
      await result.current.requestSeat('r1', null);
      await result.current.decide('r1', 'q1', 'zugesagt');
      await result.current.removeRequest('r1', 'q1');
      await result.current.removeRide('r1');
    });
    const calls = apiFetchMock.mock.calls.map((c) => [c[0], c[1]]);
    expect(calls).toContainEqual(['/events/e1/rides?clubId=club', { method: 'POST', body: { seats: 3, departurePlace: 'Platz' } }]);
    expect(calls).toContainEqual(['/events/e1/rides/r1/requests?clubId=club', { method: 'POST', body: { clubMemberId: 'kid' } }]);
    expect(calls).toContainEqual(['/events/e1/rides/r1/requests?clubId=club', { method: 'POST', body: {} }]);
    expect(calls).toContainEqual(['/events/e1/rides/r1/requests/q1?clubId=club', { method: 'PATCH', body: { status: 'zugesagt' } }]);
    expect(calls).toContainEqual(['/events/e1/rides/r1/requests/q1?clubId=club', { method: 'DELETE' }]);
    expect(calls).toContainEqual(['/events/e1/rides/r1?clubId=club', { method: 'DELETE' }]);
  });
});
