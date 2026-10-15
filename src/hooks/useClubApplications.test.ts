import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { useApplicationReview, useClubApplications } from './useClubApplications';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;

const row = (id: string) => ({ id, name: id, status: 'pending', onBehalfOf: 'self', summary: [], fileCount: 0, consentGiven: true });
const pageOf = (ids: string[], page: number, total: number) => ({ data: ids.map(row), page, pageSize: 10, total });

beforeEach(() => apiFetchMock.mockReset());

describe('useClubApplications', () => {
  it('loads a page, pages on and falls back when decisions emptied the last page', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.includes('page=1')) return Promise.resolve(pageOf(['a', 'b'], 1, 11));
      if (path.includes('page=2')) return Promise.resolve(pageOf([], 2, 10));
      return Promise.reject(new Error(path));
    });
    const { result } = await renderHook(() => useClubApplications('c1'));
    await act(async () => undefined);
    expect(apiFetchMock).toHaveBeenCalledWith('/club-applications?clubId=c1&page=1&pageSize=10');
    expect(result.current.total).toBe(11);
    expect(result.current.applications.map((a) => a.id)).toEqual(['a', 'b']);

    // page 2 is empty now (total 10 = one page): the hook falls back to page 1
    await act(async () => result.current.goToPage(2));
    await act(async () => undefined);
    expect(result.current.page).toBe(1);
  });

  it('sends the chosen category on approve and keeps note and applicant message apart on reject', async () => {
    apiFetchMock.mockResolvedValue(pageOf([], 1, 0));
    const { result } = await renderHook(() => useClubApplications('c1'));
    await act(async () => undefined);
    apiFetchMock.mockClear();
    apiFetchMock.mockResolvedValue({ data: { mapping: { applied: [], customFields: 0, skipped: [{ fieldKey: 'x', reason: 'not_answered' }] } } });
    let approved;
    await act(async () => {
      approved = await result.current.approve('a1', 'cat-1');
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/club-applications/a1/approve?clubId=c1', { method: 'POST', body: { categoryId: 'cat-1' } });
    expect(approved).toMatchObject({ mapping: { skipped: [{ fieldKey: 'x' }] } });

    apiFetchMock.mockClear();
    apiFetchMock.mockResolvedValue({});
    await act(async () => {
      await result.current.reject('a2', ' intern ', ' Nachricht ');
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/club-applications/a2/reject?clubId=c1', {
      method: 'POST',
      body: { note: 'intern', applicantMessage: 'Nachricht' },
    });
    // without a chosen category the applicant's wish stands: no body at all
    apiFetchMock.mockClear();
    apiFetchMock.mockResolvedValue({});
    await act(async () => {
      await result.current.approve('a3');
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/club-applications/a3/approve?clubId=c1', { method: 'POST', body: undefined });
  });

  it('drops a late answer after the club changed (race)', async () => {
    let releaseOld: (v: unknown) => void = () => undefined;
    apiFetchMock.mockImplementation((path: string) => {
      if (path.includes('clubId=old')) return new Promise((resolve) => (releaseOld = resolve));
      return Promise.resolve(pageOf(['new'], 1, 1));
    });
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useClubApplications(id), { initialProps: { id: 'old' } });
    await rerender({ id: 'new' });
    await act(async () => undefined);
    await act(async () => releaseOld(pageOf(['stale'], 1, 1)));
    expect(result.current.applications.map((a) => a.id)).toEqual(['new']);
  });

  it('keeps the rows and flags the error when a reload fails', async () => {
    apiFetchMock.mockResolvedValueOnce(pageOf(['a'], 1, 1));
    const { result } = await renderHook(() => useClubApplications('c1'));
    await act(async () => undefined);
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'x'));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toBe(true);
    expect(result.current.applications.map((a) => a.id)).toEqual(['a']);
  });
});

describe('useApplicationReview', () => {
  it('loads one application per club and id and drops stale answers', async () => {
    const review = (id: string) => ({ application: { id, status: 'pending' } });
    let releaseB: (v: unknown) => void = () => undefined;
    apiFetchMock.mockImplementation((path: string) =>
      path.includes('/b1') ? new Promise((resolve) => (releaseB = resolve)) : Promise.resolve({ data: review('a1') }),
    );
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useApplicationReview('c1', id), { initialProps: { id: 'a1' } });
    await act(async () => undefined);
    expect(apiFetchMock).toHaveBeenCalledWith('/club-applications/a1?clubId=c1');
    expect(result.current.review?.application.id).toBe('a1');
    await rerender({ id: 'b1' });
    // another application never shows the previous one's data
    expect(result.current.review).toBeNull();
    await act(async () => releaseB({ data: review('b1') }));
    expect(result.current.review?.application.id).toBe('b1');
  });

  it('exposes the error of a failed load', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'x'));
    const { result } = await renderHook(() => useApplicationReview('c1', 'a1'));
    await act(async () => undefined);
    expect(result.current.review).toBeNull();
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});
