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
