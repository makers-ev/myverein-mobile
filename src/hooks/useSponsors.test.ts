import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { useSponsors } from './useSponsors';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
let mockAuthed = true;
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: mockAuthed }) }));
const apiFetchMock = apiFetch as jest.Mock;

const row = (id: string, name: string) => ({ id, name, status: 'aktiv', visibility: 'intern', contacts: [] });

beforeEach(() => {
  apiFetchMock.mockReset();
  mockAuthed = true;
});

describe('useSponsors', () => {
  it('sends no request without the right (enabled = false) or without a club', async () => {
    await renderHook(() => useSponsors('c1', false));
    await renderHook(() => useSponsors(null, true));
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('loads the club list and parses it', async () => {
    apiFetchMock.mockResolvedValue({ data: [row('s1', 'Bäckerei'), { bad: true }] });
    const { result } = await renderHook(() => useSponsors('c1', true));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/sponsors?clubId=c1');
    expect(result.current.sponsors?.map((s) => s.name)).toEqual(['Bäckerei']);
  });

  it('keeps a 403 as an error with no rows (deny by default)', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'x'));
    const { result } = await renderHook(() => useSponsors('c1', true));
    await act(async () => {});
    expect(result.current.sponsors).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('keeps the old rows when a reload fails and never shows another club rows', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [row('s1', 'A')] });
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useSponsors(id, true), { initialProps: { id: 'c1' } });
    await act(async () => {});
    apiFetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.sponsors).toHaveLength(1);
    expect(result.current.error).toBeTruthy();

    apiFetchMock.mockReturnValue(new Promise(() => undefined));
    await rerender({ id: 'c2' });
    expect(result.current.sponsors).toBeNull();
  });

  it('treats a malformed answer as an error', async () => {
    apiFetchMock.mockResolvedValue({ data: 'x' });
    const { result } = await renderHook(() => useSponsors('c1', true));
    await act(async () => {});
    expect(result.current.sponsors).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
