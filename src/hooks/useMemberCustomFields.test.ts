import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import type { MemberCustomField } from '@/lib/customFields';
import { useMemberCustomFields } from './useMemberCustomFields';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;

const field = (key: string, value: unknown): MemberCustomField => ({
  id: key,
  key,
  label: key,
  type: 'text',
  options: null,
  visibleTo: 'mitglied',
  editableBy: 'self',
  sensitive: false,
  sortOrder: 0,
  archived: false,
  archivedAt: null,
  editable: true,
  value,
  updatedAt: null,
});

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => apiFetchMock.mockReset());

describe('useMemberCustomFields', () => {
  it('loads the fields of the own record', async () => {
    apiFetchMock.mockResolvedValue({ data: { fields: [field('a', 'x')] } });
    const { result } = await renderHook(() => useMemberCustomFields('c1', 'me'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/me/custom-fields?clubId=c1');
    expect(result.current.fields?.[0]?.value).toBe('x');
  });

  it('turns 403 and 404 into "hidden" and other failures into "failed" with retry', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'guest'));
    const { result } = await renderHook(() => useMemberCustomFields('c1', 'me'));
    await waitFor(() => expect(result.current.status).toBe('hidden'));

    apiFetchMock.mockRejectedValueOnce(new ApiError(500, 'X', 'boom'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.status).toBe('failed');

    apiFetchMock.mockResolvedValueOnce({ data: { fields: [] } });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.status).toBe('ready');
  });

  it('drops a late answer for a previous member and never shows its values for the new one', async () => {
    const first = deferred<unknown>();
    apiFetchMock.mockImplementation((path: string) =>
      path.includes('/m1/') ? first.promise : Promise.resolve({ data: { fields: [field('a', 'second')] } }),
    );
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useMemberCustomFields('c1', id), { initialProps: { id: 'm1' } });
    await rerender({ id: 'm2' });
    await waitFor(() => expect(result.current.fields?.[0]?.value).toBe('second'));
    await act(async () => {
      first.resolve({ data: { fields: [field('a', 'first')] } });
      await first.promise;
    });
    expect(result.current.fields?.[0]?.value).toBe('second');
  });

  it('PATCHes only the given values on the own record and takes over the fresh view', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: { fields: [field('a', 'x')] } });
    const { result } = await renderHook(() => useMemberCustomFields('c1', 'me'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    apiFetchMock.mockResolvedValueOnce({ data: { fields: [field('a', 'y')] } });
    await act(async () => {
      await result.current.save({ a: 'y' });
    });
    expect(apiFetchMock).toHaveBeenLastCalledWith('/club-members/me/custom-fields?clubId=c1', { method: 'PATCH', body: { values: { a: 'y' } } });
    expect(result.current.fields?.[0]?.value).toBe('y');
  });

  it('refuses to write another member (read-only in the app)', async () => {
    apiFetchMock.mockResolvedValue({ data: { fields: [] } });
    const { result } = await renderHook(() => useMemberCustomFields('c1', 'm9'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await expect(result.current.save({ a: 'y' })).rejects.toThrow();
  });

  it('saves for a child only when writable (guardian)', async () => {
    apiFetchMock.mockResolvedValue({ data: { fields: [field('a', 'x')] } });
    const ro = await renderHook(() => useMemberCustomFields('c1', 'k1'));
    await waitFor(() => expect(ro.result.current.status).toBe('ready'));
    await expect(ro.result.current.save({ a: 'y' })).rejects.toThrow('not editable');

    const rw = await renderHook(() => useMemberCustomFields('c1', 'k1', true));
    await waitFor(() => expect(rw.result.current.status).toBe('ready'));
    apiFetchMock.mockResolvedValueOnce({ data: { fields: [field('a', 'y')] } });
    await act(async () => {
      await rw.result.current.save({ a: 'y' });
    });
    expect(apiFetchMock).toHaveBeenLastCalledWith('/club-members/k1/custom-fields?clubId=c1', { method: 'PATCH', body: { values: { a: 'y' } } });
  });
});
