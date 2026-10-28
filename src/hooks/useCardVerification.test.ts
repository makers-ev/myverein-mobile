import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { useCardVerification } from './useCardVerification';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789';
beforeEach(() => apiFetchMock.mockReset());

describe('useCardVerification', () => {
  it('sends a token once, even when the camera reports it twice, and shows the answer', async () => {
    apiFetchMock.mockResolvedValue({ data: { result: 'gueltig', member: { displayName: 'A', category: null, initials: 'A', photo: null }, checkedAt: 'x' } });
    const { result } = await renderHook(() => useCardVerification('c1'));
    await act(async () => {
      result.current.onScan(TOKEN);
      result.current.onScan(TOKEN);
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/member-cards/verify?clubId=c1', { method: 'POST', body: { token: TOKEN } });
    expect(result.current.phase).toMatchObject({ kind: 'result', answer: { result: 'gueltig' } });
  });

  it('does not send text that is no card token', async () => {
    const { result } = await renderHook(() => useCardVerification('c1'));
    await act(async () => result.current.onScan('https://example.org/x'));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.phase).toMatchObject({ kind: 'result', notACard: true, answer: { result: 'ungueltig' } });
  });

  it('names a missing network and retries the same scan', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce({ data: { result: 'abgelaufen', checkedAt: 'x' } });
    const { result } = await renderHook(() => useCardVerification('c1'));
    await act(async () => result.current.onScan(TOKEN));
    expect(result.current.phase).toEqual({ kind: 'failed', reason: 'offline' });
    expect(result.current.canRetry).toBe(true);
    await act(async () => result.current.retry());
    expect(result.current.phase).toMatchObject({ kind: 'result', answer: { result: 'abgelaufen' } });
    expect(result.current.canRetry).toBe(false);
  });

  it('maps rate limit and missing right, forgets the token and unlocks on reset', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(429, 'TOO_MANY_REQUESTS', 'x')).mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'x'));
    const { result } = await renderHook(() => useCardVerification('c1'));
    await act(async () => result.current.onScan(TOKEN));
    expect(result.current.phase).toEqual({ kind: 'failed', reason: 'rate' });
    await act(async () => result.current.retry());
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    await act(async () => result.current.reset());
    await act(async () => result.current.onScan(TOKEN));
    expect(result.current.phase).toEqual({ kind: 'failed', reason: 'forbidden' });
  });

  it('ignores an answer that arrives after reset', async () => {
    let finish: (v: unknown) => void = () => {};
    apiFetchMock.mockImplementation(() => new Promise((r) => (finish = r)));
    const { result } = await renderHook(() => useCardVerification('c1'));
    await act(async () => result.current.onScan(TOKEN));
    await act(async () => result.current.reset());
    await act(async () => finish({ data: { result: 'gueltig', checkedAt: 'x' } }));
    expect(result.current.phase).toEqual({ kind: 'scanning' });
  });
});
