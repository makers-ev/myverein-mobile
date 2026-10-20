import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useCancelPreview, useEventMutations } from './useEvents';

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
