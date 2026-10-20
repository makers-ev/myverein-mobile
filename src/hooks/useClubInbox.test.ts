import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useClubInbox, useUnreadCount } from './useClubInbox';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const message = (id: string, readAt: string | null = null) => ({
  id,
  kind: 'announcement',
  announcementId: `a-${id}`,
  title: `T ${id}`,
  body: 'B',
  urgent: false,
  category: null,
  ctaLabel: null,
  ctaUrl: null,
  pinned: false,
  authorName: null,
  sentAt: null,
  readAt,
});

beforeEach(() => apiFetchMock.mockReset());

describe('useClubInbox', () => {
  it('does not call the API without a club', async () => {
    const { result } = await renderHook(() => useClubInbox(null));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('drops a stale answer when a newer load finished first', async () => {
    let releaseFirst: (v: unknown) => void = () => undefined;
    apiFetchMock
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce({ data: [message('new')] });
    const { result } = await renderHook(() => useClubInbox('c1'));
    await act(async () => {
      await result.current.refetch();
    });
    await act(async () => {
      releaseFirst({ data: [message('old')] });
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['new']);
  });

  it('does not show one club\'s messages after switching clubs', async () => {
    apiFetchMock.mockResolvedValue({ data: [message('x')] });
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useClubInbox(id), { initialProps: { id: 'c1' } });
    await act(async () => {});
    expect(result.current.messages).toHaveLength(1);
    apiFetchMock.mockImplementation(() => new Promise(() => undefined));
    await rerender({ id: 'c2' });
    expect(result.current.messages).toEqual([]);
  });

  it('marks a message read optimistically and calls the read route', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [message('m1')] }).mockResolvedValueOnce({ data: { id: 'm1', readAt: 'now' } });
    const { result } = await renderHook(() => useClubInbox('c1'));
    await act(async () => {});
    await act(async () => {
      await result.current.markRead('m1');
    });
    expect(result.current.messages[0]?.readAt).not.toBeNull();
    expect(apiFetchMock).toHaveBeenLastCalledWith('/club-inbox/m1/read?clubId=c1', { method: 'POST' });
  });

  it('keeps the list and exposes the error when a reload fails', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [message('m1')] }).mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useClubInbox('c1'));
    await act(async () => {});
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.error).toBeTruthy();
  });
});

describe('useUnreadCount', () => {
  it('returns the count and 0 without a club', async () => {
    apiFetchMock.mockResolvedValue({ data: { count: 3 } });
    const { result } = await renderHook(() => useUnreadCount('c1'));
    await act(async () => {});
    expect(result.current).toBe(3);
    const none = await renderHook(() => useUnreadCount(null));
    expect(none.result.current).toBe(0);
  });
});
