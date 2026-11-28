import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { useAvailabilityHints } from './useAvailabilityHints';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const input = (calendarId: string) => ({ clubId: 'club', calendarId, startsAt: '2026-06-10T16:00:00.000Z', endsAt: '2026-06-10T18:00:00.000Z' });
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
  await act(async () => {});
};

beforeEach(() => {
  jest.useFakeTimers();
  apiFetchMock.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('useAvailabilityHints', () => {
  it('forgets a 403 when the calendar changes (asks again per request)', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'no')).mockResolvedValue({ data: { counts: { total: 1, verfuegbar: 1, nicht_verfuegbar: 0, unbekannt: 0 } } });
    const { result, rerender } = await renderHook(({ cal }: { cal: string }) => useAvailabilityHints(input(cal), true), { initialProps: { cal: 'a' } });
    await settle();
    expect(result.current.forbidden).toBe(true);
    await rerender({ cal: 'b' });
    expect(result.current.forbidden).toBe(false);
    await settle();
    expect(result.current.forbidden).toBe(false);
    expect(result.current.data?.counts.total).toBe(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
});
