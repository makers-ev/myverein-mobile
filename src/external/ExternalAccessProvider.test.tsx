import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { ExternalAccessProvider, useExternalAccess } from './ExternalAccessProvider';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));

let mockClub: { clubId: string; orgRole: string } | null = null;
let mockWards = false;
jest.mock('@/clubs/ActiveClubProvider', () => ({ useActiveClub: () => ({ activeClub: mockClub }) }));
jest.mock('@/hooks/useWards', () => ({ useWards: () => ({ hasWards: mockWards }) }));

const apiFetchMock = apiFetch as jest.Mock;
const wrapper = ({ children }: { children: React.ReactNode }) => <ExternalAccessProvider>{children}</ExternalAccessProvider>;
const me = (roleTypes: string[], externalOnly = true) => ({ data: { clubId: 'g1', clubName: 'TSV', clubSlug: 'tsv', externalOnly, roleTypes, sponsors: [], assignments: [] } });

beforeEach(() => {
  apiFetchMock.mockReset();
  mockClub = { clubId: 'g1', orgRole: 'guest' };
  mockWards = false;
});

describe('ExternalAccessProvider', () => {
  it('makes no call for an own club and keeps the normal app', async () => {
    mockClub = { clubId: 'c1', orgRole: 'member' };
    const { result } = await renderHook(() => useExternalAccess(), { wrapper });
    await act(async () => {});
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ role: null, reduced: false, loading: false });
  });

  it('resolves sponsor, service provider and both roles from /external/me', async () => {
    let release: (v: unknown) => void = () => undefined;
    apiFetchMock.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const { result } = await renderHook(() => useExternalAccess(), { wrapper });
    // Waits for the answer instead of showing the member app.
    expect(result.current).toMatchObject({ loading: true, reduced: true, role: null });
    await act(async () => {
      release(me(['dienstleister', 'sponsor']));
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/external/me?clubId=g1');
    expect(result.current).toMatchObject({ role: 'sponsor', roles: ['sponsor', 'dienstleister'], reduced: true, loading: false });
  });

  it('treats a guest that is not external-only (a guardian) as a normal member', async () => {
    apiFetchMock.mockResolvedValue(me([], false));
    const { result } = await renderHook(() => useExternalAccess(), { wrapper });
    await act(async () => {});
    expect(result.current).toMatchObject({ role: null, reduced: false, loading: false });
  });

  it('fails closed when the role cannot be read', async () => {
    apiFetchMock.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useExternalAccess(), { wrapper });
    await act(async () => {});
    expect(result.current.role).toBeNull();
    expect(result.current.reduced).toBe(true);
    expect(result.current.error).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });

  it('does not lock a guardian out of the member screens when the call fails', async () => {
    mockWards = true;
    apiFetchMock.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useExternalAccess(), { wrapper });
    await act(async () => {});
    expect(result.current.reduced).toBe(false);
  });

  it('lets the newest request win over a slower older one', async () => {
    let releaseFirst: (v: unknown) => void = () => undefined;
    apiFetchMock.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)));
    const { result } = await renderHook(() => useExternalAccess(), { wrapper });
    apiFetchMock.mockResolvedValueOnce(me(['dienstleister']));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.role).toBe('dienstleister');
    await act(async () => {
      releaseFirst(me(['sponsor']));
    });
    expect(result.current.role).toBe('dienstleister');
  });

  it('retries on its own while the role is unknown after a failure', async () => {
    jest.useFakeTimers();
    try {
      apiFetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(me(['sponsor']));
      const { result } = await renderHook(() => useExternalAccess(), { wrapper });
      await act(async () => {});
      expect(result.current.role).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(21_000);
      });
      expect(result.current.role).toBe('sponsor');
      expect(result.current.error).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
