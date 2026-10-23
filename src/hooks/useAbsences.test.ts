import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { privacyErrorKey } from '@/lib/ward';
import { useAbsences, useClubAbsencesToday, type Absence } from './useAbsences';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const absence = (id: string): Absence => ({ id, clubMemberId: 'm1', kind: 'krank', startsOn: '2026-10-22', endsOn: '2026-10-23', note: null, reportedByKind: 'self', withdrawnAt: null });
const input = { kind: 'krank' as const, startsOn: '2026-10-22', endsOn: '2026-10-23', note: null };

beforeEach(() => apiFetchMock.mockReset());

describe('useAbsences', () => {
  it('uses the own routes for the caller and the ward routes for a child', async () => {
    apiFetchMock.mockResolvedValue({ data: [] });
    await renderHook(() => useAbsences({ kind: 'self', clubId: 'c1' }));
    await renderHook(() => useAbsences({ kind: 'ward', clubId: 'c1', wardId: 'w1' }));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/absences?clubId=c1');
    expect(apiFetchMock).toHaveBeenCalledWith('/guardian/wards/w1/absences?clubId=c1');
  });

  it('posts a new report to the ward route and reloads', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: absence('a1') }).mockResolvedValueOnce({ data: [absence('a1')] });
    const { result } = await renderHook(() => useAbsences({ kind: 'ward', clubId: 'c1', wardId: 'w1' }));
    await act(async () => {});
    let out: { ok: boolean } = { ok: false };
    await act(async () => {
      out = await result.current.create(input);
    });
    expect(out.ok).toBe(true);
    expect(apiFetchMock).toHaveBeenCalledWith('/guardian/wards/w1/absences?clubId=c1', { method: 'POST', body: input });
    expect(result.current.absences).toHaveLength(1);
  });

  it('returns the backend error code of a rejected report without reloading', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new ApiError(422, 'VALIDATION_ERROR', 'x', { code: 'period_too_long' }));
    const { result } = await renderHook(() => useAbsences({ kind: 'self', clubId: 'c1' }));
    await act(async () => {});
    let out: { ok: boolean; error?: unknown } = { ok: true };
    await act(async () => {
      out = await result.current.create(input);
    });
    expect(out.ok).toBe(false);
    expect(privacyErrorKey(out.error)).toBe('absence.error.too-long');
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('withdraws optimistically and brings the row back when the call fails', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [absence('a1')] }).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [absence('a1')] });
    const { result } = await renderHook(() => useAbsences({ kind: 'self', clubId: 'c1' }));
    await act(async () => {});
    await act(async () => {
      await result.current.withdraw('a1');
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/absences/a1?clubId=c1', { method: 'DELETE' });
    expect(result.current.absences).toHaveLength(1);
  });

  it('exposes a 403 so the own section can hide for external guests', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'x'));
    const { result } = await renderHook(() => useAbsences({ kind: 'self', clubId: 'c1' }));
    await act(async () => {});
    expect((result.current.error as ApiError).status).toBe(403);
    expect(result.current.absences).toEqual([]);
  });
});

describe('useClubAbsencesToday', () => {
  it('asks for today only and not at all without the permission', async () => {
    apiFetchMock.mockResolvedValue({ data: [] });
    await renderHook(() => useClubAbsencesToday('c1', false));
    expect(apiFetchMock).not.toHaveBeenCalled();
    await renderHook(() => useClubAbsencesToday('c1', true));
    const url = apiFetchMock.mock.calls[0]![0] as string;
    const [, from, to] = url.match(/from=([\d-]+)&to=([\d-]+)/)!;
    expect(from).toBe(to);
  });
});
