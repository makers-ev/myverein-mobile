// Pure helpers for the digital membership card (Wave 13 M6/M7). No native modules, so everything is unit-testable.
import { ApiError } from './api';

export type CardState = 'gueltig' | 'abgelaufen' | 'ausgetreten' | 'ungueltig' | 'nicht_ausgestellt';

/** `GET /club-members/me/card` (or `/:id/card` for a child). `token` is the QR text and exists only while `state = gueltig`. */
export interface MemberCard {
  clubMemberId: string;
  cardId: string | null;
  issued: boolean;
  state: CardState;
  hint: 'widerrufen' | 'ruhend' | 'keine_mitgliedschaft' | null;
  validUntil: string | null;
  issuedAt: string | null;
  token: string | null;
  tokenExpiresAt: string | null;
  member: { displayName: string; memberNumber: string | null; category: string | null; initials: string };
  club: { name: string; primaryColor: string | null; accentColor: string | null; logo: { url: string } | null };
  photo: { url: string } | null;
  photoConsent: boolean;
  checkedAt: string;
}

/** What is kept on the device for offline display: no signed URLs (they expire), the photo is a local file. */
export interface CachedCard {
  userId: string;
  card: Omit<MemberCard, 'photo' | 'club'> & { club: Omit<MemberCard['club'], 'logo'> };
  photoUri: string | null;
  photoSavedAt: string | null;
  savedAt: string;
}

const CARD_STATES: readonly string[] = ['gueltig', 'abgelaufen', 'ausgetreten', 'ungueltig', 'nicht_ausgestellt'];

/** Storage-safe key (SecureStore allows letters, digits, `.`, `-`, `_`) for one card of one club. */
export function cardSubjectKey(clubId: string, memberKey: string): string {
  return `${clubId}_${memberKey}`.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
}

/** Only a valid card with a token is worth keeping offline; every other state clears the copy. */
export const shouldCacheCard = (card: Pick<MemberCard, 'state' | 'token'>): boolean => card.state === 'gueltig' && !!card.token;

/** The state to show: a cached `gueltig` card whose end date has passed is `abgelaufen` (device date, `today` = `YYYY-MM-DD`). */
export function effectiveCardState(card: Pick<MemberCard, 'state' | 'validUntil'>, today: string): CardState {
  if (card.state === 'gueltig' && card.validUntil && card.validUntil < today) return 'abgelaufen';
  return card.state;
}

/** The QR may be shown only while the card is valid and its token has not expired (an unknown expiry counts as valid). */
export function canShowQr(card: Pick<MemberCard, 'state' | 'validUntil' | 'token' | 'tokenExpiresAt'>, today: string, now: number): boolean {
  if (!card.token || effectiveCardState(card, today) !== 'gueltig') return false;
  if (card.tokenExpiresAt) {
    const expires = Date.parse(card.tokenExpiresAt);
    if (Number.isFinite(expires) && expires <= now) return false;
  }
  return true;
}

export function toCachedCard(card: MemberCard, userId: string, photoUri: string | null, photoSavedAt: string | null, now: Date): CachedCard {
  const { photo: _photo, club, ...rest } = card;
  const { logo: _logo, ...clubRest } = club;
  void _photo;
  void _logo;
  return { userId, card: { ...rest, club: clubRest }, photoUri, photoSavedAt, savedAt: now.toISOString() };
}

/** Parses a stored record; anything malformed or of another account is dropped (`null`). */
export function parseCachedCard(raw: string | null, userId: string): CachedCard | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<CachedCard> | null;
    const c = v?.card;
    if (!v || v.userId !== userId || !c || typeof c.token !== 'string' || !CARD_STATES.includes(c.state) || typeof c.member?.displayName !== 'string' || typeof c.club?.name !== 'string') return null;
    return {
      userId: v.userId,
      card: c,
      photoUri: typeof v.photoUri === 'string' ? v.photoUri : null,
      photoSavedAt: typeof v.photoSavedAt === 'string' ? v.photoSavedAt : null,
      savedAt: typeof v.savedAt === 'string' ? v.savedAt : c.checkedAt,
    };
  } catch {
    return null;
  }
}

/** Without any server answer (no network, timeout): the cached card may be shown. */
export const isOfflineFailure = (err: unknown): boolean => !(err instanceof ApiError) || err.status === 0;

/** The server says there is no card for this person (any more) or no access: the local copy must go. */
export const isCardGone = (err: unknown): boolean => err instanceof ApiError && (err.status === 404 || err.status === 401 || err.status === 403);

/** `YYYY-MM-DD` of the device's local day. */
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "Stand von 28.10.2026, 14:05" for the offline hint. */
export function formatCardStand(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A stored photo is refreshed at most once a day (the signed URL is new on every card read). */
export function photoNeedsRefresh(cached: Pick<CachedCard, 'photoUri' | 'photoSavedAt'> | null, hasPhoto: boolean, now: number): boolean {
  if (!hasPhoto) return false;
  if (!cached?.photoUri || !cached.photoSavedAt) return true;
  const saved = Date.parse(cached.photoSavedAt);
  return !Number.isFinite(saved) || now - saved > 24 * 60 * 60 * 1000;
}

// --- Card check (M7) ---

export type VerifyResult = 'gueltig' | 'abgelaufen' | 'ausgetreten' | 'ungueltig';

/** Scanned text that cannot be one of our tokens (about 60 printable chars, no spaces, no URL/Wi-Fi/contact payload) is "ungültig" without asking the server. */
export function looksLikeCardToken(text: string): boolean {
  if (!/^[\x21-\x7E]{16,256}$/.test(text)) return false;
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(text) && !/^(WIFI|MECARD|BEGIN|mailto|tel|geo|smsto|sms|matmsg):/i.test(text);
}

export interface VerifyAnswer {
  result: VerifyResult;
  member?: { displayName: string; category: string | null; initials: string; photo: { url: string } | null };
  checkedAt: string;
}

/** Defensive read of the verify answer: an unknown `result` is never shown as valid. */
export function readVerifyAnswer(raw: unknown): VerifyAnswer {
  const v = (raw as { data?: Partial<VerifyAnswer> } | null)?.data;
  const result: VerifyResult = v?.result === 'gueltig' || v?.result === 'abgelaufen' || v?.result === 'ausgetreten' ? v.result : 'ungueltig';
  return { result, member: result === 'gueltig' ? v?.member : undefined, checkedAt: typeof v?.checkedAt === 'string' ? v.checkedAt : '' };
}
