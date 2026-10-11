import { act, renderHook, waitFor } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useKeyHistory, useLocationMutations } from './useLocations';

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { apiFetch: jest.fn(), ApiError };
});

const fetchMock = apiFetch as jest.Mock;
const entry = (id: string) => ({
  id,
  action: 'issued',
  memberId: 'm',
  memberName: 'A',
  keyLabel: null,
  note: null,
  recordedBy: null,
  recordedByName: 'B',
  createdAt: '2026-10-01T00:00:00Z',
});

beforeEach(() => fetchMock.mockReset());

describe('useKeyHistory', () => {
  it('sets forbidden on 403 and exposes no entries', async () => {
    const { ApiError } = jest.requireMock('@/lib/api');
    fetchMock.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'x'));
    const { result } = await renderHook(() => useKeyHistory('c1', 'l1', true));
    await waitFor(() => expect(result.current.forbidden).toBe(true));
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toBe(false);
  });

  it('makes no request while disabled', async () => {
    const { result } = await renderHook(() => useKeyHistory('c1', 'l1', false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('ignores a stale response after the location changed', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    fetchMock
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ data: [entry('new')], page: 1, pageSize: 20, total: 1 });
    const { result, rerender } = await renderHook(({ loc }: { loc: string }) => useKeyHistory('c1', loc, true), {
      initialProps: { loc: 'l1' },
    });
    await rerender({ loc: 'l2' });
    await waitFor(() => expect(result.current.entries.map((e) => e.id)).toEqual(['new']));
    await act(async () => resolveFirst({ data: [entry('old')], page: 1, pageSize: 20, total: 1 }));
    expect(result.current.entries.map((e) => e.id)).toEqual(['new']);
  });

  it('appends further pages without duplicates', async () => {
    fetchMock
      .mockResolvedValueOnce({ data: [entry('a'), entry('b')], page: 1, pageSize: 20, total: 3 })
      .mockResolvedValueOnce({ data: [entry('b'), entry('c')], page: 2, pageSize: 20, total: 3 });
    const { result } = await renderHook(() => useKeyHistory('c1', 'l1', true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);
  });
});

describe('useLocationMutations.returnKey', () => {
  it('sends a DELETE body only with a note', async () => {
    fetchMock.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useLocationMutations('c1'));
    await result.current.returnKey('l1', 'm1');
    await result.current.returnKey('l1', 'm1', 'verloren');
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: 'DELETE', body: undefined });
    expect(fetchMock.mock.calls[1][1]).toEqual({ method: 'DELETE', body: { note: 'verloren' } });
    expect(fetchMock.mock.calls[0][0]).toBe('/locations/l1/key-holders/m1?clubId=c1');
  });
});
