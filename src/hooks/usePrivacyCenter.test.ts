import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { useDataExportSummary, useDataRequests, useDpaStatus, useFieldVisibility } from './usePrivacyCenter';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

beforeEach(() => apiFetchMock.mockReset());

describe('useDataRequests', () => {
  it('lists the own requests and files an erasure request, then reloads', async () => {
    const open = { id: 'r1', kind: 'erasure', status: 'open', receivedAt: '2026-10-01T00:00:00Z', dueAt: '2026-11-01T00:00:00Z', completedAt: null };
    apiFetchMock.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: open }).mockResolvedValueOnce({ data: [open] });
    const { result } = await renderHook(() => useDataRequests('c1'));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/me/data-requests?clubId=c1');
    let out: { ok: boolean } = { ok: false };
    await act(async () => {
      out = await result.current.requestErasure();
    });
    expect(out.ok).toBe(true);
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/me/erasure-request?clubId=c1', { method: 'POST' });
    expect(result.current.requests).toHaveLength(1);
  });

  it('reports a failed request with its error', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new ApiError(403, 'DPA_REQUIRED', 'x'));
    const { result } = await renderHook(() => useDataRequests('c1'));
    await act(async () => {});
    let out: { ok: boolean; error?: unknown } = { ok: true };
    await act(async () => {
      out = await result.current.requestErasure();
    });
    expect(out.ok).toBe(false);
    expect((out.error as ApiError).code).toBe('DPA_REQUIRED');
  });
});

describe('useDataExportSummary', () => {
  it('keeps only counts of the export', async () => {
    apiFetchMock.mockResolvedValue({ data: { generatedAt: '2026-10-01T00:00:00Z', sections: { member: { name: 'Secret' } }, files: [] } });
    const { result } = await renderHook(() => useDataExportSummary('c1'));
    await act(async () => {
      await result.current.load();
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/me/data-export?format=json&clubId=c1');
    expect(result.current.summary?.sections).toEqual([{ key: 'member', count: 1 }]);
    expect(JSON.stringify(result.current.summary)).not.toContain('Secret');
  });
});

describe('useFieldVisibility', () => {
  it('switches a field optimistically and rolls back by reload when refused', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: { clubMemberId: 'm1', levels: { phone: 'nur_vorstand' } } })
      .mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'x'))
      .mockResolvedValueOnce({ data: { clubMemberId: 'm1', levels: { phone: 'nur_vorstand' } } });
    const { result } = await renderHook(() => useFieldVisibility('c1', 'm1'));
    await act(async () => {});
    expect(result.current.levels?.email).toBe('nur_vorstand');
    let out: { ok: boolean } = { ok: true };
    await act(async () => {
      out = await result.current.setLevel('phone', 'trainer');
    });
    expect(out.ok).toBe(false);
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/m1/visibility?clubId=c1', { method: 'PUT', body: { phone: 'trainer' } });
    expect(result.current.levels?.phone).toBe('nur_vorstand');
  });
});

describe('useDpaStatus', () => {
  it('reads the status of the club', async () => {
    apiFetchMock.mockResolvedValue({ data: { version: null, status: { required: false }, canAccept: true } });
    await renderHook(() => useDpaStatus('c1'));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/dpa/current?clubId=c1');
  });
});
