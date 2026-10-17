import { renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { childName, useMyChildren } from './useMyChildren';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;
const child = { clubMemberId: 'k1', displayName: 'Mia M.', firstName: 'Mia', lastName: 'M', status: 'aktiv' };

beforeEach(() => apiFetchMock.mockReset());

describe('useMyChildren', () => {
  it('loads the children of the club', async () => {
    apiFetchMock.mockResolvedValue({ data: [child] });
    const { result } = await renderHook(() => useMyChildren('c1'));
    await waitFor(() => expect(result.current.children).toHaveLength(1));
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/me/children?clubId=c1');
  });

  it.each([403, 404, 429, 500])('fails silently on %s (no children, not loading)', async (status) => {
    apiFetchMock.mockRejectedValue(new ApiError(status, 'X', 'x'));
    const { result } = await renderHook(() => useMyChildren('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.children).toEqual([]);
  });

  it('does not request without a club and drops the old club on a switch', async () => {
    const none = await renderHook(() => useMyChildren(null));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(none.result.current.children).toEqual([]);

    apiFetchMock.mockResolvedValue({ data: [child] });
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useMyChildren(id), { initialProps: { id: 'c1' } });
    await waitFor(() => expect(result.current.children).toHaveLength(1));
    apiFetchMock.mockReturnValue(new Promise(() => {}));
    await rerender({ id: 'c2' });
    expect(result.current.children).toEqual([]);
  });

  it('names a child', () => {
    expect(childName(child)).toBe('Mia M.');
    expect(childName({ displayName: null, firstName: 'Mia', lastName: 'Muster' })).toBe('Mia Muster');
    expect(childName({ displayName: null, firstName: null, lastName: null })).toBe('—');
  });
});
