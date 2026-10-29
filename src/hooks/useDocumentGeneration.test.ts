import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useDocumentGeneration } from './useDocumentGeneration';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const job = (status: string, documentId: string | null = null) => ({ data: { id: 'j1', templateId: 't', status, errorCode: null, documentId } });

beforeEach(() => {
  apiFetchMock.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('useDocumentGeneration', () => {
  it('reports "still running" instead of a failure when a poll fails after the job was created', async () => {
    apiFetchMock.mockResolvedValueOnce(job('wartet')).mockRejectedValueOnce(new Error('Network request failed'));
    const { result } = await renderHook(() => useDocumentGeneration('c1'));
    let outcome: unknown;
    await act(async () => {
      const p = result.current.request('mitgliedsbestaetigung', { clubMemberId: 'm1' });
      await jest.advanceTimersByTimeAsync(2000);
      outcome = await p;
    });
    expect(outcome).toMatchObject({ ok: true, job: { status: 'wartet' } });
  });

  it('still reports a failure when the job could not be created', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('x'));
    const { result } = await renderHook(() => useDocumentGeneration('c1'));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.request('mitgliedsbestaetigung', {});
    });
    expect(outcome).toMatchObject({ ok: false, job: null });
  });

  it('returns the finished job after polling', async () => {
    apiFetchMock.mockResolvedValueOnce(job('wartet')).mockResolvedValueOnce(job('fertig', 'd1'));
    const { result } = await renderHook(() => useDocumentGeneration('c1'));
    let outcome: unknown;
    await act(async () => {
      const p = result.current.request('mitgliedsbestaetigung', {});
      await jest.advanceTimersByTimeAsync(2000);
      outcome = await p;
    });
    expect(outcome).toMatchObject({ ok: true, job: { documentId: 'd1' } });
  });
});
