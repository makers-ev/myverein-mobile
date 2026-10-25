import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useCancelPreview, useEventMutations, useEventSeries, useSeriesDetail } from './useEvents';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const input = { calendarId: 'c', title: 't', description: null, startsAt: 'a', endsAt: null, category: null, capacity: null };

beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({}));

describe('useEventMutations notify', () => {
  it('sends notify:false on PATCH only when switched off', async () => {
    const { result } = await renderHook(() => useEventMutations('club'));
    await act(async () => {
      await result.current.updateEvent('e1', input);
      await result.current.updateEvent('e1', input, false);
    });
    expect(apiFetchMock.mock.calls[0][1].body).toEqual(input);
    expect(apiFetchMock.mock.calls[1][1].body).toEqual({ ...input, notify: false });
  });

  it('uses ?notify=false on DELETE and posts the cancel body', async () => {
    const { result } = await renderHook(() => useEventMutations('club'));
    await act(async () => {
      await result.current.deleteEvent('e1', false);
      await result.current.cancelEvent('e1', ' Regen ', false);
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/events/e1?clubId=club&notify=false', { method: 'DELETE' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/events/e1/cancel?clubId=club', { method: 'POST', body: { reason: 'Regen', notify: false } });
  });
});

describe('useCancelPreview', () => {
  it('does not request without an event and loads the preview with one', async () => {
    const { result, rerender } = await renderHook(({ id }: { id: string | null }) => useCancelPreview('club', id), { initialProps: { id: null } });
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    apiFetchMock.mockResolvedValueOnce({ data: { alreadyCancelled: false, audience: { total: 2 } } });
    await rerender({ id: 'e1' });
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/events/e1/cancel-preview?clubId=club');
    expect(result.current.preview?.audience.total).toBe(2);
  });
});

describe('useEventSeries', () => {
  it('previews with the limit, creates, patches and refetches after writes', async () => {
    const onChanged = jest.fn();
    const { result } = await renderHook(() => useEventSeries('club', onChanged));
    apiFetchMock.mockResolvedValue({ data: {} });
    await act(async () => {
      await result.current.previewSeries({ title: 'x' }, 5);
      await result.current.createSeries({ title: 'x' });
      await result.current.updateSeries('s1', { scope: 'all' });
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/event-series/preview?clubId=club&limit=5', { method: 'POST', body: { title: 'x' } });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/event-series?clubId=club', { method: 'POST', body: { title: 'x' } });
    expect(apiFetchMock).toHaveBeenNthCalledWith(3, '/event-series/s1?clubId=club', { method: 'PATCH', body: { scope: 'all' } });
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it('deletes with scope, occurrence and notify flag', async () => {
    const onChanged = jest.fn();
    const { result } = await renderHook(() => useEventSeries('club', onChanged));
    apiFetchMock.mockResolvedValue({ data: { deleted: 1, cancelled: 0, seriesDeleted: false } });
    await act(async () => {
      await result.current.deleteSeries('s1', 'this_and_following', 'e1', { reason: 'Regen', notify: false });
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/event-series/s1?clubId=club&scope=this_and_following&eventId=e1&reason=Regen&notify=false', { method: 'DELETE' });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when a write fails', async () => {
    const onChanged = jest.fn();
    const { result } = await renderHook(() => useEventSeries('club', onChanged));
    apiFetchMock.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await expect(result.current.updateSeries('s1', {})).rejects.toThrow('boom');
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('useSeriesDetail', () => {
  it('stays idle without a series id and loads the series with one', async () => {
    const { result, rerender } = await renderHook(({ id }: { id: string | null }) => useSeriesDetail('club', id), { initialProps: { id: null } });
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    apiFetchMock.mockResolvedValueOnce({ data: { id: 's1', freq: 'weekly' } });
    await rerender({ id: 's1' });
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/event-series/s1?clubId=club');
    expect(result.current.series?.freq).toBe('weekly');
  });
});
