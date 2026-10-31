import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useCalendarFeeds } from './useCalendarFeeds';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const feed = { id: 'f1', label: 'Handy', calendarId: null, calendarName: null, createdAt: 'x', lastUsedAt: null };

beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({ data: [feed] }));

describe('useCalendarFeeds', () => {
  it('does not load while disabled and loads the list once enabled', async () => {
    const { result, rerender } = await renderHook(({ on }: { on: boolean }) => useCalendarFeeds('club', on), { initialProps: { on: false } });
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    await rerender({ on: true });
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/calendar-feeds?clubId=club');
    expect(result.current.feeds).toEqual([feed]);
  });

  it('creates with a trimmed label, returns the one-time link and refreshes the list', async () => {
    const { result } = await renderHook(() => useCalendarFeeds('club', true));
    await act(async () => {});
    apiFetchMock.mockResolvedValueOnce({ data: { ...feed, token: 't', url: 'u', webcalUrl: 'w' } }).mockResolvedValue({ data: [feed] });
    let created: { token: string } | undefined;
    await act(async () => {
      created = await result.current.createFeed('cal', ' Handy ');
    });
    expect(created?.token).toBe('t');
    expect(apiFetchMock).toHaveBeenCalledWith('/calendar-feeds?clubId=club', { method: 'POST', body: { calendarId: 'cal', label: 'Handy' } });
    expect(apiFetchMock).toHaveBeenLastCalledWith('/calendar-feeds?clubId=club');
  });

  it('revokes and rotates the given link', async () => {
    const { result } = await renderHook(() => useCalendarFeeds('club', true));
    await act(async () => {});
    apiFetchMock.mockResolvedValue({ data: [] });
    await act(async () => {
      await result.current.revokeFeed('f1');
      await result.current.rotateFeed('f1');
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/calendar-feeds/f1?clubId=club', { method: 'DELETE' });
    expect(apiFetchMock).toHaveBeenCalledWith('/calendar-feeds/f1/rotate?clubId=club', { method: 'POST' });
  });

  it('exposes a failed load as error with an empty list', async () => {
    apiFetchMock.mockRejectedValue(new Error('down'));
    const { result } = await renderHook(() => useCalendarFeeds('club', true));
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.feeds).toEqual([]);
  });
});
