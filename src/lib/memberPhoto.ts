import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/apiErrorMessage';

/**
 * True if the birth date (`YYYY-MM-DD`) is known and the person is under 18 on `today`. An unknown or
 * unparsable birth date counts as adult, like the backend (`isMinor` in lib/member-photos.ts): minors cannot
 * set their own photo, the board does. Advisory only -- the backend decides (403).
 */
export function isMinorBirthDate(birthDate: string | null | undefined, today: Date = new Date()): boolean {
  if (!birthDate) return false;
  const [y, m, d] = birthDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return false;
  let age = today.getFullYear() - y;
  const hadBirthday = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age < 18;
}

/** Translation key for a failed photo upload/removal. Quota and other coded errors win over the generic "image unusable". */
export function photoFailureKey(err: unknown, ownPhoto: boolean): string {
  if (err instanceof ApiError && err.status === 403 && ownPhoto) return 'member-photo.error.minor';
  if (err instanceof ApiError && err.status === 422 && err.code !== 'QUOTA_EXCEEDED') return 'member-photo.error.invalid';
  return apiErrorKey(err);
}

function detailsCode(err: ApiError): string | undefined {
  const d = err.details as { code?: unknown } | null | undefined;
  return d && typeof d === 'object' && typeof d.code === 'string' ? d.code : undefined;
}

/**
 * Translation key for a failed generic image upload (`POST /media`, 10 MB). The backend tells two quota cases
 * apart via `details.code`: `unattached_cap` (per-user limit of 25 not-yet-saved files / 50 MB, cleaned up after
 * 24 h) and `club_quota` (club storage); without a code the generic quota text is used.
 */
export function imageUploadFailureKey(err: unknown): string {
  if (err instanceof ApiError && detailsCode(err) === 'unattached_cap') return 'media.error.unattached-cap';
  if (err instanceof ApiError && err.status === 422 && err.code !== 'QUOTA_EXCEEDED') return 'media.error.invalid';
  if (err instanceof ApiError && err.status === 413 && err.code !== 'QUOTA_EXCEEDED') return 'media.error.invalid';
  return apiErrorKey(err);
}

/** True for failures without a server answer (network, timeout): the request may still have succeeded. */
export function isNetworkFailure(err: unknown): boolean {
  return !(err instanceof ApiError);
}

/** 422 for a `photoKey` the backend no longer has as unattached, i.e. it was already used (e.g. by a lost-response save). */
export function isUnknownMediaKey(err: unknown): boolean {
  return err instanceof ApiError && err.status === 422 && /unknown media key/i.test(err.message);
}
