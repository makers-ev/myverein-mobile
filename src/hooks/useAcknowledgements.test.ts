import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useAcknowledgements, useConfirmAcknowledgement } from './useAcknowledgements';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

beforeEach(() => apiFetchMock.mockReset());

describe('useAcknowledgements', () => {
  it('counts only open requests the caller may answer', async () => {
    apiFetchMock.mockResolvedValue({
      data: [
        { id: '1', status: 'offen', canAnswer: true },
        { id: '2', status: 'offen', canAnswer: false },
        { id: '3', status: 'bestaetigt', canAnswer: false },
      ],
      page: 1,
      pageSize: 50,
      total: 3,
    });
    const { result } = await renderHook(() => useAcknowledgements('c1'));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/acknowledgements/mine?clubId=c1&page=1&pageSize=50');
    expect(result.current.openCount).toBe(1);
    expect(result.current.hasMore).toBe(false);
  });

  it('loads further pages without duplicates and keeps the list when a page fails', async () => {
    const row = (id: string) => ({ id, status: 'offen', canAnswer: true });
    apiFetchMock.mockResolvedValueOnce({ data: [row('1'), row('2')], page: 1, pageSize: 2, total: 4 });
    const { result } = await renderHook(() => useAcknowledgements('c1'));
    await act(async () => {});
    expect(result.current.hasMore).toBe(true);
    apiFetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => result.current.loadMore());
    expect(result.current.items).toHaveLength(2);
    expect(result.current.error).toBeTruthy();
    apiFetchMock.mockResolvedValueOnce({ data: [row('2'), row('3'), row('4')], page: 2, pageSize: 2, total: 4 });
    await act(async () => result.current.loadMore());
    expect(apiFetchMock).toHaveBeenLastCalledWith('/acknowledgements/mine?clubId=c1&page=2&pageSize=50');
    expect(result.current.items?.map((a) => a.id)).toEqual(['1', '2', '3', '4']);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe('useConfirmAcknowledgement', () => {
  it('ignores a second tap while an answer is running and sends the password only when given', async () => {
    let finish: () => void = () => {};
    apiFetchMock.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    const { result } = await renderHook(() => useConfirmAcknowledgement('c1'));
    let first: Promise<unknown> = Promise.resolve();
    let second: unknown = 'unset';
    await act(async () => {
      first = result.current.confirm('a1', 'bestaetigt', 'secret');
      second = await result.current.confirm('a1', 'bestaetigt', 'secret');
    });
    expect(second).toBeUndefined();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/acknowledgements/a1/confirm?clubId=c1', { method: 'POST', body: { decision: 'bestaetigt', password: 'secret' } });
    await act(async () => {
      finish();
      expect(await first).toBeNull();
    });
  });

  it('returns the failure instead of throwing', async () => {
    const err = new Error('x');
    apiFetchMock.mockRejectedValue(err);
    const { result } = await renderHook(() => useConfirmAcknowledgement('c1'));
    let out: unknown;
    await act(async () => {
      out = await result.current.confirm('a1', 'abgelehnt');
    });
    expect(out).toEqual({ error: err });
    expect(apiFetchMock).toHaveBeenCalledWith('/acknowledgements/a1/confirm?clubId=c1', { method: 'POST', body: { decision: 'abgelehnt' } });
  });
});
