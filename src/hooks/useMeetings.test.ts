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

describe('useMeetings list envelope', () => {
  const meeting = { id: 'm1', type: 'mitgliederversammlung', status: 'geplant', title: 'MV' };
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  async function load(answer: unknown) {
    apiFetchMock.mockReset().mockResolvedValue(answer);
    const { result } = await renderHook(() => useMeetings('club'));
    await act(async () => {});
    return result.current;
  }

  it('accepts {data: array}', async () => {
    const r = await load({ data: [meeting] });
    expect(r.meetings).toEqual([meeting]);
    expect(r.error).toBe(false);
  });

  it('accepts a bare array', async () => {
    const r = await load([meeting]);
    expect(r.meetings).toEqual([meeting]);
    expect(r.error).toBe(false);
  });

  it.each([undefined, null, {}, { data: undefined }, { data: { items: [] } }])('keeps an array and flags error for %p', async (answer) => {
    const r = await load(answer);
    expect(Array.isArray(r.meetings)).toBe(true);
    expect(r.meetings).toEqual([]);
    expect(r.error).toBe(true);
  });

  it('keeps an array and flags error when the request fails', async () => {
    apiFetchMock.mockReset().mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useMeetings('club'));
    await act(async () => {});
    expect(result.current.meetings).toEqual([]);
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});
