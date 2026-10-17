import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { DEFAULT_OVERVIEW_QUERY, type CredentialOverviewResponse, type OverviewQuery } from '@/lib/credentials';
import { useCredentialOverview } from './useCredentialOverview';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;

const response = (label: string): CredentialOverviewResponse => ({
  data: [
    {
      clubMemberId: 'm1',
      displayName: label,
      fieldKey: 'k',
      fieldLabel: 'K',
      sensitive: false,
      value: { valid: true },
      updatedAt: null,
      expiry: { status: 'valid', daysLeft: null, validUntil: null },
    },
  ],
  page: 1,
  pageSize: 25,
  total: 1,
  today: '2026-10-17',
  withinDays: 90,
  fields: [{ id: 'f1', key: 'k', label: 'K', sensitive: false, options: null }],
});

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => apiFetchMock.mockReset());

describe('useCredentialOverview', () => {
  it('loads a page and the field list', async () => {
    apiFetchMock.mockResolvedValue(response('Anna'));
    const { result } = await renderHook(() => useCredentialOverview('c1', DEFAULT_OVERVIEW_QUERY));
    await waitFor(() => expect(result.current.response?.data[0]?.displayName).toBe('Anna'));
    expect(result.current.fields).toHaveLength(1);
    expect(apiFetchMock.mock.calls[0]![0]).toContain('/club-members/credentials?clubId=c1');
  });

  it('is hidden for 403 and for 404 without a field filter, never for a filtered 404', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'no'));
    const a = await renderHook(() => useCredentialOverview('c1', DEFAULT_OVERVIEW_QUERY));
    await waitFor(() => expect(a.result.current.hidden).toBe(true));

    apiFetchMock.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'no'));
    const b = await renderHook(() => useCredentialOverview('c2', DEFAULT_OVERVIEW_QUERY));
    await waitFor(() => expect(b.result.current.hidden).toBe(true));

    const c = await renderHook(() => useCredentialOverview('c3', { ...DEFAULT_OVERVIEW_QUERY, fieldKey: 'gone' }));
    await waitFor(() => expect(c.result.current.failure).toBe('notFound'));
    expect(c.result.current.hidden).toBe(false);
  });

  it('shows a generic error for 429 and does not retry on its own', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'slow down'));
    const { result } = await renderHook(() => useCredentialOverview('c1', DEFAULT_OVERVIEW_QUERY));
    await waitFor(() => expect(result.current.failure).toBe('generic'));
    expect(result.current.hidden).toBe(false);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops a late answer for a previous filter and a previous club', async () => {
    const slow = deferred<CredentialOverviewResponse>();
    apiFetchMock.mockReturnValueOnce(slow.promise).mockResolvedValue(response('Neu'));
    const { result, rerender } = await renderHook(({ clubId, query }: { clubId: string; query: OverviewQuery }) => useCredentialOverview(clubId, query), {
      initialProps: { clubId: 'c1', query: DEFAULT_OVERVIEW_QUERY },
    });
    await rerender({ clubId: 'c1', query: { ...DEFAULT_OVERVIEW_QUERY, status: 'expired' } });
    await waitFor(() => expect(result.current.response?.data[0]?.displayName).toBe('Neu'));
    await act(async () => slow.resolve(response('Alt')));
    expect(result.current.response?.data[0]?.displayName).toBe('Neu');

    apiFetchMock.mockReturnValue(new Promise(() => undefined));
    await rerender({ clubId: 'c2', query: DEFAULT_OVERVIEW_QUERY });
    expect(result.current.response).toBeNull();
    expect(result.current.fields).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('reports a generic failure and reloads', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('Anna'));
    const { result } = await renderHook(() => useCredentialOverview('c1', DEFAULT_OVERVIEW_QUERY));
    await waitFor(() => expect(result.current.failure).toBe('generic'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.response?.data).toHaveLength(1);
    expect(result.current.failure).toBeNull();
  });
});
