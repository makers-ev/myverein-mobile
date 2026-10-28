jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import {
  canShowQr,
  cardSubjectKey,
  effectiveCardState,
  formatCardStand,
  isCardGone,
  isOfflineFailure,
  looksLikeCardToken,
  parseCachedCard,
  photoNeedsRefresh,
  readVerifyAnswer,
  shouldCacheCard,
  toCachedCard,
  type MemberCard,
} from './memberCard';

const card: MemberCard = {
  clubMemberId: 'm1', cardId: 'c1', issued: true, state: 'gueltig', hint: null, validUntil: '2026-12-31', issuedAt: '2026-01-01', token: 'abcdefghijklmnopqrstuvwxyz0123456789', tokenExpiresAt: null,
  member: { displayName: 'Mia Muster', memberNumber: '12', category: 'Aktiv', initials: 'MM' },
  club: { name: 'TSV', primaryColor: '#112233', accentColor: null, logo: { url: 'https://signed/logo' } },
  photo: { url: 'https://signed/photo' }, photoConsent: true, checkedAt: '2026-10-28T12:00:00Z',
};

describe('card state', () => {
  it('caches only valid cards with a token', () => {
    expect(shouldCacheCard(card)).toBe(true);
    expect(shouldCacheCard({ ...card, state: 'ausgetreten', token: null })).toBe(false);
    expect(shouldCacheCard({ ...card, token: null })).toBe(false);
  });

  it('turns a locally expired card into abgelaufen and hides the QR', () => {
    expect(effectiveCardState(card, '2026-12-31')).toBe('gueltig');
    expect(effectiveCardState(card, '2027-01-01')).toBe('abgelaufen');
    expect(canShowQr(card, '2026-10-28', 0)).toBe(true);
    expect(canShowQr(card, '2027-01-01', 0)).toBe(false);
    expect(canShowQr({ ...card, tokenExpiresAt: '2026-10-01T00:00:00Z' }, '2026-10-28', Date.parse('2026-10-28T00:00:00Z'))).toBe(false);
    expect(canShowQr({ ...card, token: null }, '2026-10-28', 0)).toBe(false);
  });
});

describe('cache record', () => {
  it('drops signed urls and rejects another account or garbage', () => {
    const cached = toCachedCard(card, 'u1', 'file:///p.jpg', '2026-10-28T12:00:00Z', new Date('2026-10-28T12:00:00Z'));
    const raw = JSON.stringify(cached);
    expect(raw).not.toContain('signed');
    expect(parseCachedCard(raw, 'u1')?.card.token).toBe(card.token);
    expect(parseCachedCard(raw, 'u2')).toBeNull();
    expect(parseCachedCard('{', 'u1')).toBeNull();
    expect(parseCachedCard(null, 'u1')).toBeNull();
    expect(parseCachedCard(JSON.stringify({ userId: 'u1', card: { state: 'x' } }), 'u1')).toBeNull();
  });

  it('builds storage safe keys and refreshes photos daily', () => {
    expect(cardSubjectKey('c 1', 'a/b')).toBe('c_1_a_b');
    expect(photoNeedsRefresh(null, true, 0)).toBe(true);
    expect(photoNeedsRefresh(null, false, 0)).toBe(false);
    const c = { photoUri: 'x', photoSavedAt: '2026-10-28T12:00:00Z' };
    expect(photoNeedsRefresh(c, true, Date.parse('2026-10-28T13:00:00Z'))).toBe(false);
    expect(photoNeedsRefresh(c, true, Date.parse('2026-10-30T13:00:00Z'))).toBe(true);
  });
});

describe('failures', () => {
  it('separates offline from "card gone"', () => {
    expect(isOfflineFailure(new Error('Network request failed'))).toBe(true);
    expect(isOfflineFailure(new ApiError(500, 'X', 'x'))).toBe(false);
    expect(isCardGone(new ApiError(404, 'NOT_FOUND', 'x'))).toBe(true);
    expect(isCardGone(new ApiError(500, 'X', 'x'))).toBe(false);
    expect(isCardGone(new Error('offline'))).toBe(false);
  });

  it('formats the stand', () => {
    expect(formatCardStand(null)).toBe('');
    expect(formatCardStand('garbage')).toBe('');
    expect(formatCardStand('2026-10-28T12:05:00')).toBe('28.10.2026, 12:05');
  });
});

describe('verify', () => {
  it('only sends token-shaped text', () => {
    expect(looksLikeCardToken('abcdefghijklmnopqrstuvwxyz0123456789')).toBe(true);
    expect(looksLikeCardToken('WIFI:S:home;T:WPA;P:secret;;')).toBe(false);
    expect(looksLikeCardToken('https://example.org/x')).toBe(false);
    expect(looksLikeCardToken('')).toBe(false);
  });

  it('never shows an unknown answer as valid', () => {
    expect(readVerifyAnswer({ data: { result: 'gueltig', member: { displayName: 'A', category: null, initials: 'A', photo: null }, checkedAt: 'x' } }).result).toBe('gueltig');
    expect(readVerifyAnswer({ data: { result: 'whatever' } }).result).toBe('ungueltig');
    expect(readVerifyAnswer(null).result).toBe('ungueltig');
    expect(readVerifyAnswer({ data: { result: 'abgelaufen', member: { displayName: 'A' } } }).member).toBeUndefined();
  });
});
