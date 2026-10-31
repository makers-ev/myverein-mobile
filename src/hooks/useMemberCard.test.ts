import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import type { CachedCard, MemberCard } from '@/lib/memberCard';
import { dropCachedCard, loadCachedCard, saveCachedCard } from '@/lib/memberCardCache';
import { useMemberCard, type MemberCardSubject } from './useMemberCard';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1' } }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
jest.mock('@/lib/memberCardCache', () => ({ cardPhotoUri: jest.fn(() => null), loadCachedCard: jest.fn(), saveCachedCard: jest.fn(), dropCachedCard: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;
const loadMock = loadCachedCard as jest.Mock;
const saveMock = saveCachedCard as jest.Mock;
const dropMock = dropCachedCard as jest.Mock;

const card = (over: Partial<MemberCard> = {}): MemberCard => ({
  clubMemberId: 'm1', cardId: 'c1', issued: true, state: 'gueltig', hint: null, validUntil: null, issuedAt: null, token: 'tok-abcdefghijklmnop', tokenExpiresAt: null,
  member: { displayName: 'Mia', memberNumber: null, category: null, initials: 'M' }, club: { name: 'TSV', primaryColor: null, accentColor: null, logo: null },
  photo: null, photoConsent: false, checkedAt: '2026-10-28T12:00:00Z', ...over,
});
const cached = (): CachedCard => ({ userId: 'u1', card: { ...card(), club: { name: 'TSV', primaryColor: null, accentColor: null } }, photoFile: null, photoSavedAt: null, savedAt: '2026-10-27T12:00:00Z' });

function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const SELF: MemberCardSubject = { kind: 'self', clubId: 'c1' };

beforeEach(() => {
  apiFetchMock.mockReset();
  loadMock.mockReset().mockResolvedValue(null);
  saveMock.mockReset().mockImplementation(async (_k, c) => ({ ...cached(), card: c }));
  dropMock.mockReset().mockResolvedValue(undefined);
});

describe('useMemberCard', () => {
  it('shows and caches a valid live card', async () => {
    apiFetchMock.mockResolvedValue({ data: card() });
    const { result } = await renderHook(() => useMemberCard(SELF));
    await act(async () => {});
    expect(apiFetchMock).toHaveBeenCalledWith('/club-members/me/card?clubId=c1');
    expect(result.current.view?.fromCache).toBe(false);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached copy when the network is down', async () => {
    loadMock.mockResolvedValue(cached());
    apiFetchMock.mockRejectedValue(new Error('Network request failed'));
    const { result } = await renderHook(() => useMemberCard(SELF));
    await act(async () => {});
    expect(result.current.view?.fromCache).toBe(true);
    expect(result.current.offline).toBe(true);
    expect(dropMock).not.toHaveBeenCalled();
  });

  it('wipes the copy when the server says there is no card or the card is no longer valid', async () => {
    loadMock.mockResolvedValue(cached());
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'x'));
    const gone = await renderHook(() => useMemberCard(SELF));
    await act(async () => {});
    expect(gone.result.current.gone).toBe(true);
    expect(gone.result.current.view).toBeNull();
    expect(dropMock).toHaveBeenCalledTimes(1);

    apiFetchMock.mockResolvedValueOnce({ data: card({ state: 'ausgetreten', token: null }) });
    const left = await renderHook(() => useMemberCard(SELF));
    await act(async () => {});
    expect(left.result.current.view?.card.state).toBe('ausgetreten');
    expect(left.result.current.view?.fromCache).toBe(false);
    expect(dropMock).toHaveBeenCalledTimes(2);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('ignores a late answer for another subject', async () => {
    const slow = deferred<{ data: MemberCard }>();
    apiFetchMock.mockImplementation((path: string) => (path.includes('/w1/') ? slow.promise : Promise.resolve({ data: card({ clubMemberId: 'm2' }) })));
    const { result, rerender } = await renderHook((s: MemberCardSubject) => useMemberCard(s), { initialProps: { kind: 'ward', clubId: 'c1', wardId: 'w1' } as MemberCardSubject });
    await rerender(SELF);
    await act(async () => {});
    expect(result.current.view?.card.clubMemberId).toBe('m2');
    await act(async () => slow.resolve({ data: card({ clubMemberId: 'late' }) }));
    expect(result.current.view?.card.clubMemberId).toBe('m2');
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
