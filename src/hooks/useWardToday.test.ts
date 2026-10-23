import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useWardEvents } from './useWardToday';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const event = (id: string, response: string | null = null) => ({ id, title: `T ${id}`, startsAt: '2026-10-22T16:00:00.000Z', response, canRespond: true, cancelledAt: null });

beforeEach(() => apiFetchMock.mockReset());

describe('useWardEvents', () => {
  it('does not call the API without a ward', async () => {
    await renderHook(() => useWardEvents('c1', null));
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('never shows another ward\'s events after switching', async () => {
    apiFetchMock.mockResolvedValue({ data: [event('e1')] });
    const { result, rerender } = await renderHook(({ w }: { w: string }) => useWardEvents('c1', w), { initialProps: { w: 'w1' } });
    await act(async () => {});
    expect(result.current.events).toHaveLength(1);
    apiFetchMock.mockImplementation(() => new Promise(() => undefined));
    await rerender({ w: 'w2' });
    expect(result.current.events).toEqual([]);
  });

  it('sets the answer at once, calls PUT with the status and clears it with DELETE', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [event('e1')] }).mockResolvedValue({ data: {} });
    const { result } = await renderHook(() => useWardEvents('c1', 'w1'));
    await act(async () => {});
    await act(async () => {
      await result.current.respond('e1', 'abgesagt');
    });
    expect(result.current.events[0]?.response).toBe('abgesagt');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/guardian/wards/w1/events/e1/response?clubId=c1', { method: 'PUT', body: { status: 'abgesagt' } });
    await act(async () => {
      await result.current.respond('e1', null);
    });
    expect(apiFetchMock).toHaveBeenLastCalledWith('/guardian/wards/w1/events/e1/response?clubId=c1', { method: 'DELETE' });
  });

  it('reloads the server state and reports failure when the answer is rejected', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [event('e1')] }).mockRejectedValueOnce(new Error('409')).mockResolvedValueOnce({ data: [event('e1')] });
    const { result } = await renderHook(() => useWardEvents('c1', 'w1'));
    await act(async () => {});
    let out: { ok: boolean } = { ok: true };
    await act(async () => {
      out = await result.current.respond('e1', 'angemeldet');
    });
    expect(out.ok).toBe(false);
    expect(result.current.events[0]?.response).toBeNull();
  });
});
