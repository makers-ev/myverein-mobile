import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { WardsProvider, useWardsContext } from './WardsProvider';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const clubState = { clubs: [] as unknown[], loading: false, error: false };
jest.mock('@/clubs/ActiveClubProvider', () => ({ useActiveClub: () => clubState }));
const apiFetchMock = apiFetch as jest.Mock;

const groups = (...ids: string[]) => ({ data: [{ clubId: 'c1', clubName: 'TSV', wards: ids.map((id) => ({ wardId: id, name: `Kind ${id}`, firstName: id, openConsents: 0 })) }] });
const wrapper = ({ children }: { children: React.ReactNode }) => <WardsProvider>{children}</WardsProvider>;

beforeEach(() => {
  apiFetchMock.mockReset();
  clubState.clubs = [];
  clubState.loading = false;
  clubState.error = false;
});

describe('WardsProvider', () => {
  it('is guardian-only with wards and no club membership', async () => {
    apiFetchMock.mockResolvedValue(groups('w1'));
    const { result } = await renderHook(() => useWardsContext(), { wrapper });
    await act(async () => {});
    expect(result.current.hasWards).toBe(true);
    expect(result.current.guardianOnly).toBe(true);
    expect(result.current.selected?.wardId).toBe('w1');
  });

  it('is not guardian-only for a club member, and not while the clubs are loading or failed', async () => {
    apiFetchMock.mockResolvedValue(groups('w1'));
    clubState.clubs = [{ clubId: 'c1' }];
    const member = await renderHook(() => useWardsContext(), { wrapper });
    await act(async () => {});
    expect(member.result.current.guardianOnly).toBe(false);
    expect(member.result.current.hasWards).toBe(true);

    clubState.clubs = [];
    clubState.error = true;
    const failed = await renderHook(() => useWardsContext(), { wrapper });
    await act(async () => {});
    expect(failed.result.current.guardianOnly).toBe(false);
  });

  it('falls back to the first ward when the selected link is gone after a reload', async () => {
    apiFetchMock.mockResolvedValueOnce(groups('w1', 'w2'));
    const { result } = await renderHook(() => useWardsContext(), { wrapper });
    await act(async () => {});
    await act(async () => result.current.select('c1:w2'));
    expect(result.current.selected?.wardId).toBe('w2');
    apiFetchMock.mockResolvedValueOnce(groups('w1'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.selected?.wardId).toBe('w1');
  });

  it('keeps the list when a reload fails', async () => {
    apiFetchMock.mockResolvedValueOnce(groups('w1')).mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useWardsContext(), { wrapper });
    await act(async () => {});
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.hasWards).toBe(true);
    expect(result.current.error).toBe(true);
  });
});
