import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { useConsents, type ConsentView } from './useConsents';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const view = (over: Partial<ConsentView> = {}): ConsentView => ({
  purposeId: 'p1',
  key: 'photos',
  name: 'Fotos',
  description: null,
  requested: true,
  state: 'none',
  open: true,
  text: { id: 't1', version: 1, body: 'Text' },
  recordedTextVersion: null,
  outdated: false,
  givenBy: null,
  decidedAt: null,
  ...over,
});

const self = { kind: 'self' as const, clubId: 'c1', clubMemberId: 'm1' };
const ward = { kind: 'ward' as const, clubId: 'c1', wardId: 'w1', canConsent: true };

beforeEach(() => apiFetchMock.mockReset());

describe('useConsents', () => {
  it('reads the own consents from the member route and a child\'s from the guardian route', async () => {
    apiFetchMock.mockResolvedValue({ data: { consents: [] } });
    await renderHook(() => useConsents(self));
    await renderHook(() => useConsents(ward));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/m1/consents?clubId=c1');
    expect(apiFetchMock).toHaveBeenCalledWith('/guardian/wards/w1/consents?clubId=c1');
  });

  it('grants against the shown text version and writes through the member route also for a child', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: { consents: [view()] } })
      .mockResolvedValueOnce({ data: view({ state: 'granted', open: false }) })
      .mockResolvedValueOnce({ data: { consents: [view({ state: 'granted', open: false })] } });
    const { result } = await renderHook(() => useConsents(ward));
    await act(async () => {});
    let out: { ok: boolean } = { ok: false };
    await act(async () => {
      out = await result.current.grant(result.current.consents[0]!);
    });
    expect(out.ok).toBe(true);
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/w1/consents/p1?clubId=c1', { method: 'POST', body: { textVersionId: 't1' } });
    expect(result.current.consents[0]?.state).toBe('granted');
    expect(result.current.open).toBe(0);
  });

  it('refreshes the list and reports outdated on 409 consent_text_outdated', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: { consents: [view()] } })
      .mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'x', { code: 'consent_text_outdated', currentTextVersionId: 't2' }))
      .mockResolvedValueOnce({ data: { consents: [view({ text: { id: 't2', version: 2, body: 'Neu' } })] } });
    const { result } = await renderHook(() => useConsents(self));
    await act(async () => {});
    let out: { ok: boolean; outdated?: boolean } = { ok: true };
    await act(async () => {
      out = await result.current.grant(result.current.consents[0]!);
    });
    expect(out).toMatchObject({ ok: false, outdated: true });
    expect(result.current.consents[0]?.text.version).toBe(2);
  });

  it('revokes with DELETE and does not mark a plain failure as outdated', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: { consents: [view({ state: 'granted', open: false })] } })
      .mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'x', { code: 'guardian_cannot_consent' }))
      .mockResolvedValueOnce({ data: { consents: [view({ state: 'granted', open: false })] } });
    const { result } = await renderHook(() => useConsents(self));
    await act(async () => {});
    let out: { ok: boolean; outdated?: boolean } = { ok: true };
    await act(async () => {
      out = await result.current.revoke(result.current.consents[0]!);
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/m1/consents/p1?clubId=c1', { method: 'DELETE' });
    expect(out).toMatchObject({ ok: false, outdated: false });
  });

  it('a guardian link without can_consent may read but not decide', async () => {
    apiFetchMock.mockResolvedValue({ data: { consents: [view()] } });
    const { result } = await renderHook(() => useConsents({ ...ward, canConsent: false }));
    await act(async () => {});
    expect(result.current.canDecide).toBe(false);
    expect(result.current.consents).toHaveLength(1);
  });

  it('drops a stale answer for another child after switching', async () => {
    apiFetchMock.mockResolvedValue({ data: { consents: [view()] } });
    const { result, rerender } = await renderHook(({ w }: { w: string }) => useConsents({ ...ward, wardId: w }), { initialProps: { w: 'w1' } });
    await act(async () => {});
    expect(result.current.consents).toHaveLength(1);
    apiFetchMock.mockImplementation(() => new Promise(() => undefined));
    await rerender({ w: 'w2' });
    expect(result.current.consents).toEqual([]);
  });
});
