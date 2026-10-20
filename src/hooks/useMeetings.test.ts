import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useMeetings } from './useMeetings';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({ data: [] }));

describe('useMeetings notify', () => {
  it('passes notify:false in PATCH bodies and ?notify=false on DELETE', async () => {
    const { result } = await renderHook(() => useMeetings('club'));
    await act(async () => {});
    apiFetchMock.mockClear();
    await act(async () => {
      await result.current.updateMeeting('m1', { scheduledAt: null, notify: false });
      await result.current.deleteMeeting('m1', false);
      await result.current.deleteMeeting('m1');
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/meetings/m1?clubId=club', { method: 'PATCH', body: { scheduledAt: null, notify: false } });
    expect(apiFetchMock).toHaveBeenCalledWith('/meetings/m1?clubId=club&notify=false', { method: 'DELETE' });
    expect(apiFetchMock).toHaveBeenCalledWith('/meetings/m1?clubId=club', { method: 'DELETE' });
  });
});
