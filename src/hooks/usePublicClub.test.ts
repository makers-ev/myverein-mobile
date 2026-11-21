import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { usePublicClub } from './usePublicClub';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

beforeEach(() => apiFetchMock.mockReset());

describe('usePublicClub', () => {
  it('does not call the API without a slug', async () => {
    const { result } = await renderHook(() => usePublicClub(null));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.info).toBeNull();
    expect(result.current.missing).toBe(false);
  });

  it('loads the released public page', async () => {
    apiFetchMock.mockResolvedValue({ data: { name: 'TSV', tagline: 'Sport', contact: {}, events: [] } });
    const { result } = await renderHook(() => usePublicClub('tsv'));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/public/clubs/tsv');
    expect(result.current.info?.name).toBe('TSV');
  });

  it('treats 404 as "no public page", not as an error', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'x'));
    const { result } = await renderHook(() => usePublicClub('tsv'));
    await act(async () => {});
    expect(result.current.missing).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('reports other failures and a malformed answer as errors', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'X', 'x'));
    const { result } = await renderHook(() => usePublicClub('tsv'));
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.missing).toBe(false);

    apiFetchMock.mockResolvedValue({ data: { nope: 1 } });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeTruthy();
  });
});
