// Form-input parsers: `null` = empty field, `NaN` = invalid input.

/** "12,50" / "12.5" -> 1250 cents. */
export function parseEuroToCents(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : NaN;
}

/** 1250 -> "12,50" for prefilling the euro input. */
export function centsToEuroInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

/** Positive whole number, e.g. a maintenance interval in days. */
export function parsePositiveInt(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  return /^\d+$/.test(s) && Number(s) > 0 ? Number(s) : NaN;
}

/** Decimal coordinate within [-limit, limit]; accepts a comma as decimal separator. */
export function parseCoordinate(input: string, limit: 90 | 180): number | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  const n = /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  return Math.abs(n) <= limit ? n : NaN;
}
