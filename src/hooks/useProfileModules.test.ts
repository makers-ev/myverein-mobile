import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import type { CatalogResponse } from '@/lib/profileModules';
import { useProfileModules } from './useProfileModules';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;

const catalog = (used: number): CatalogResponse => ({ data: { lang: 'de', groups: [], modules: [], limit: { used, max: 100 } } });

beforeEach(() => apiFetchMock.mockReset());

describe('useProfileModules', () => {
  it('loads the catalog with club and language', async () => {
    apiFetchMock.mockResolvedValue(catalog(1));
    const { result } = await renderHook(() => useProfileModules('c1', 'en'));
    await waitFor(() => expect(result.current.data?.limit.used).toBe(1));
    expect(apiFetchMock).toHaveBeenCalledWith('/member-fields/catalog?clubId=c1&lang=en');
  });

  it('does nothing without a club (no request, no loading)', async () => {
    const { result } = await renderHook(() => useProfileModules(null, 'de'));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('maps failures to forbidden / rateLimit / generic and retries', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'x'));
    const { result } = await renderHook(() => useProfileModules('c1', 'de'));
    await waitFor(() => expect(result.current.failure).toBe('forbidden'));
    apiFetchMock.mockRejectedValueOnce(new ApiError(429, 'TOO_MANY_REQUESTS', 'x'));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.failure).toBe('rateLimit'));
    apiFetchMock.mockResolvedValueOnce(catalog(2));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.data?.limit.used).toBe(2));
    expect(result.current.failure).toBeNull();
  });

  it('toggles with POST and reloads; rejects with the ApiError', async () => {
    apiFetchMock.mockResolvedValueOnce(catalog(1));
    const { result } = await renderHook(() => useProfileModules('c1', 'de'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    apiFetchMock.mockResolvedValueOnce({}).mockResolvedValueOnce(catalog(2));
    await act(async () => result.current.toggle('mod_a', 'activate'));
    expect(apiFetchMock).toHaveBeenCalledWith('/member-fields/catalog/mod_a/activate?clubId=c1&lang=de', { method: 'POST', body: {} });
    await waitFor(() => expect(result.current.data?.limit.used).toBe(2));

    apiFetchMock.mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'x', { code: 'custom_field_limit' }));
    await expect(result.current.toggle('mod_b', 'activate')).rejects.toBeInstanceOf(ApiError);
  });

  it('drops the previous language\'s catalog on a language switch', async () => {
    apiFetchMock.mockResolvedValue(catalog(1));
    const { result, rerender } = await renderHook(({ lang }: { lang: 'de' | 'en' }) => useProfileModules('c1', lang), { initialProps: { lang: 'de' as 'de' | 'en' } });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    apiFetchMock.mockReturnValue(new Promise(() => {}));
    await rerender({ lang: 'en' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
