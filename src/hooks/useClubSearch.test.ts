import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useClubSearch } from './useClubSearch';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

beforeEach(() => {
  apiFetchMock.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const flush = async () => {
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
};

describe('useClubSearch', () => {
  it('does not call the API below the minimum length', async () => {
    const { result } = await renderHook(({ q }: { q: string }) => useClubSearch(q), { initialProps: { q: 'ts' } });
    await flush();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('searches debounced with the trimmed query and returns the hits', async () => {
    apiFetchMock.mockResolvedValue({ data: [{ slug: 'tsv', name: 'TSV Ost', city: 'Ulm', logoUrl: null }] });
    const { result } = await renderHook(({ q }: { q: string }) => useClubSearch(q), { initialProps: { q: '  tsv ' } });
    await flush();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/public/clubs?q=tsv');
    expect(result.current.phase).toBe('done');
    expect(result.current.hits.map((h) => h.slug)).toEqual(['tsv']);
  });

  it('keeps no results for an empty answer and reports a failure as an error state', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [] });
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useClubSearch(q), { initialProps: { q: 'abc' } });
    await flush();
    expect(result.current.phase).toBe('done');
    expect(result.current.hits).toEqual([]);

    apiFetchMock.mockRejectedValueOnce(new Error('boom'));
    await rerender({ q: 'abcd' });
    await flush();
    expect(result.current.phase).toBe('error');
    expect(result.current.hits).toEqual([]);
  });

  it('never shows the hits of an older query for a newer one', async () => {
    apiFetchMock.mockResolvedValue({ data: [{ slug: 'a', name: 'A Verein', city: null, logoUrl: null }] });
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useClubSearch(q), { initialProps: { q: 'abc' } });
    await flush();
    await rerender({ q: 'abcd' });
    expect(result.current.hits).toEqual([]);
    expect(result.current.phase).toBe('loading');
  });
});
