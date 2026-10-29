import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { useArchiveDocuments, useArchiveFolders, useMemberDocuments, type ArchiveDocument } from './useDocuments';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const doc = (id: string): ArchiveDocument => ({
  id,
  folderId: 'f1',
  kind: 'hochgeladen',
  docType: null,
  title: id,
  status: 'aktiv',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  level: 'lesen',
  currentVersion: { versionNo: 1, mimeType: 'application/pdf', sizeBytes: 10, originalFilename: null, createdAt: '2026-10-01T00:00:00Z' },
});

function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => apiFetchMock.mockReset());

describe('useMemberDocuments', () => {
  it('uses `me` for the caller and the ward id for a child', async () => {
    apiFetchMock.mockResolvedValue({ data: [] });
    await renderHook(() => useMemberDocuments({ kind: 'self', clubId: 'c1' }));
    await renderHook(() => useMemberDocuments({ kind: 'ward', clubId: 'c1', wardId: 'w1' }));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/member-documents/me?clubId=c1');
    expect(apiFetchMock).toHaveBeenCalledWith('/member-documents/w1?clubId=c1');
  });

  it('never shows the previous child\'s list after switching', async () => {
    const first = deferred<{ data: unknown[] }>();
    apiFetchMock.mockImplementation((path: string) => (path.includes('/w1?') ? first.promise : Promise.resolve({ data: [{ id: 'd2' }] })));
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useMemberDocuments({ kind: 'ward', clubId: 'c1', wardId: id }), { initialProps: { id: 'w1' } });
    await rerender({ id: 'w2' });
    await act(async () => {});
    expect(result.current.documents).toEqual([{ id: 'd2' }]);
    await act(async () => first.resolve({ data: [{ id: 'd1' }] }));
    expect(result.current.documents).toEqual([{ id: 'd2' }]);
  });

  it('exposes a 404 (link ended) without data', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'x'));
    const { result } = await renderHook(() => useMemberDocuments({ kind: 'ward', clubId: 'c1', wardId: 'w1' }));
    await act(async () => {});
    expect(result.current.documents).toBeNull();
    expect((result.current.error as ApiError).status).toBe(404);
  });
});

describe('useArchiveFolders', () => {
  it('keeps no answer after a 403 (external guest) and loads per club', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'x'));
    const { result } = await renderHook(() => useArchiveFolders('c1'));
    await act(async () => {});
    expect(result.current.answer).toBeNull();
    expect(apiFetchMock).toHaveBeenCalledWith('/documents/folders?clubId=c1');
  });

  it('drops a late answer of the previous club', async () => {
    const first = deferred<unknown>();
    const answer = (name: string) => ({ data: [{ id: name, parentId: null, name, systemKey: null, level: 'lesen' }], rootLevel: null, maxDepth: 5 });
    apiFetchMock.mockImplementation((path: string) => (path.includes('clubId=c1') ? first.promise : Promise.resolve(answer('B'))));
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useArchiveFolders(id), { initialProps: { id: 'c1' } });
    await rerender({ id: 'c2' });
    await act(async () => {});
    await act(async () => first.resolve(answer('A')));
    expect(result.current.answer?.data[0]?.name).toBe('B');
  });
});

describe('useArchiveDocuments', () => {
  it('does not request anything without a folder or query', async () => {
    const { result } = await renderHook(() => useArchiveDocuments('c1', null, ''));
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.documents).toBeNull();
  });

  it('loads active documents of a folder, appends the next page without duplicates and a query ignores the folder', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: [doc('a'), doc('b')], page: 1, pageSize: 30, total: 3 })
      .mockResolvedValueOnce({ data: [doc('b'), doc('c')], page: 2, pageSize: 30, total: 3 });
    const { result } = await renderHook(() => useArchiveDocuments('c1', 'f1', ''));
    await act(async () => {});
    expect(apiFetchMock.mock.calls[0]![0]).toBe('/documents?clubId=c1&status=aktiv&page=1&pageSize=30&folderId=f1');
    expect(result.current.hasMore).toBe(true);
    await act(async () => result.current.loadMore());
    expect(result.current.documents?.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);
  });

  it('uses q instead of folderId for a search', async () => {
    apiFetchMock.mockResolvedValue({ data: [], page: 1, pageSize: 30, total: 0 });
    await renderHook(() => useArchiveDocuments('c1', 'f1', ' Satzung '));
    await act(async () => {});
    const url = apiFetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('q=Satzung');
    expect(url).not.toContain('folderId');
  });

  it('ignores a late answer of the previous folder', async () => {
    const first = deferred<unknown>();
    apiFetchMock.mockImplementation((path: string) =>
      path.includes('folderId=f1') ? first.promise : Promise.resolve({ data: [doc('new')], page: 1, pageSize: 30, total: 1 }),
    );
    const { result, rerender } = await renderHook(({ f }: { f: string }) => useArchiveDocuments('c1', f, ''), { initialProps: { f: 'f1' } });
    await rerender({ f: 'f2' });
    await act(async () => {});
    await act(async () => first.resolve({ data: [doc('old')], page: 1, pageSize: 30, total: 1 }));
    expect(result.current.documents?.map((d) => d.id)).toEqual(['new']);
  });
});
