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

/** Translation key for a failed generic image upload (`POST /media`, 10 MB). Quota and other coded errors win over "image unusable". */
export function imageUploadFailureKey(err: unknown): string {
  if (err instanceof ApiError && err.status === 422 && err.code !== 'QUOTA_EXCEEDED') return 'media.error.invalid';
  if (err instanceof ApiError && err.status === 413 && err.code !== 'QUOTA_EXCEEDED') return 'media.error.invalid';
  return apiErrorKey(err);
}
