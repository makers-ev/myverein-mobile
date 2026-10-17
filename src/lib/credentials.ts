import type { TextTranslations } from './customFields';
import type { FormField } from './formSchema';

/**
 * Pure helpers of the profile modules' `credential` type (Profil-Bausteine, backend `src/lib/credentials.ts`): the value
 * `{ valid: true, level?, obtainedOn?, validUntil? }`, the expiry view the server computes (Europe/Berlin day, no
 * notifications before Wave 9) and the query of the board's credential overview (`GET /club-members/credentials`).
 * The server is the authority for the status; the app only renders it. Values are never logged or persisted.
 */

export interface CredentialValue {
  valid: true;
  level?: string;
  obtainedOn?: string;
  validUntil?: string;
}

export const EXPIRY_STATUSES = ['missing', 'valid', 'expiring', 'expired'] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

/** Expiry view of a credential field: `daysLeft` is 0 on the last valid day, negative when expired, `null` without a date. */
export interface CredentialExpiry {
  status: ExpiryStatus;
  daysLeft: number | null;
  validUntil: string | null;
}

/** Who entered a value (backend `enteredBy`): the person themself, the board, a guardian (child's record), or unknown (`null`, older rows / backend). */
export type EnteredBy = 'self' | 'board' | 'guardian';

/**
 * Credential/protected values are unverified unless the board entered them: callers show a hint when a value exists and
 * `enteredBy` is anything but `board` (`self`, `guardian`, an unknown future value, or `null` for a stored value of an older
 * backend). Only credential and protected fields qualify; the caller checks that a value exists.
 */
export const isUnverifiedSelfEntry = (field: { type?: string; sensitive?: boolean; enteredBy?: EnteredBy | string | null }): boolean =>
  field.enteredBy !== 'board' && (field.type === 'credential' || field.sensitive === true);

/** Translation key of the unverified-entry hint (guardian vs. generic self-declaration), `null` when no hint applies. */
export const unverifiedEntryKey = (field: { type?: string; sensitive?: boolean; enteredBy?: EnteredBy | string | null }): string | null =>
  !isUnverifiedSelfEntry(field) ? null : field.enteredBy === 'guardian' ? 'forms.cred.guardianEntered' : 'forms.cred.selfEntered';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** How the level of a credential is entered: a pick from the definition's `options`, free text (`validation.maxLength`) or not at all. */
export function credentialLevelMode(field: Pick<FormField, 'options' | 'validation'>): 'select' | 'text' | 'none' {
  if (field.options && field.options.length > 0) return 'select';
  if (field.validation?.maxLength !== undefined) return 'text';
  return 'none';
}

/** The stored value if it looks like a credential, else `null` (anything unexpected is treated as "not held"). */
export function parseCredential(value: unknown): CredentialValue | null {
  if (!isRecord(value) || value.valid !== true) return null;
  const out: CredentialValue = { valid: true };
  if (typeof value.level === 'string' && value.level.trim() !== '') out.level = value.level;
  if (typeof value.obtainedOn === 'string' && value.obtainedOn !== '') out.obtainedOn = value.obtainedOn;
  if (typeof value.validUntil === 'string' && value.validUntil !== '') out.validUntil = value.validUntil;
  return out;
}

/**
 * The next value after an edit: `have = false` clears (`undefined`, sent as `null`); otherwise the previous value merged with
 * the patch, keys in canonical order, empty strings / `null` / `undefined` dropped (the server stores exactly these keys).
 */
export function buildCredentialValue(
  previous: unknown,
  patch: { have?: boolean; level?: string | null; obtainedOn?: string | null; validUntil?: string | null },
): CredentialValue | undefined {
  if (patch.have === false) return undefined;
  const base = parseCredential(previous) ?? { valid: true as const };
  const merged = {
    level: 'level' in patch ? patch.level : base.level,
    obtainedOn: 'obtainedOn' in patch ? patch.obtainedOn : base.obtainedOn,
    validUntil: 'validUntil' in patch ? patch.validUntil : base.validUntil,
  };
  const out: CredentialValue = { valid: true };
  if (typeof merged.level === 'string' && merged.level.trim() !== '') out.level = merged.level;
  if (typeof merged.obtainedOn === 'string' && merged.obtainedOn !== '') out.obtainedOn = merged.obtainedOn;
  if (typeof merged.validUntil === 'string' && merged.validUntil !== '') out.validUntil = merged.validUntil;
  return out;
}

/** The server's expiry belongs to the saved value: once the date was edited it is stale and not shown. */
export function expiryApplies(expiry: CredentialExpiry | null | undefined, value: unknown): expiry is CredentialExpiry {
  if (!expiry) return false;
  const current = parseCredential(value);
  if (!current) return expiry.status === 'missing';
  return (current.validUntil ?? null) === expiry.validUntil && expiry.status !== 'missing';
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Text of the expiry badge (never colour only: the badge also carries an icon, see `ExpiryBadge`): "expires in N days",
 * "expired", "valid until <date>".
 */
export function expiryLabel(expiry: CredentialExpiry, t: Translate, formatDate: (v: string) => string): string {
  const until = expiry.validUntil ? formatDate(expiry.validUntil) : '';
  switch (expiry.status) {
    case 'expired':
      return until ? t('forms.cred.expiry.expiredOn', { date: until }) : t('forms.cred.expiry.expired');
    case 'expiring': {
      const days = expiry.daysLeft ?? 0;
      if (days <= 0) return t('forms.cred.expiry.today');
      if (days === 1) return t('forms.cred.expiry.tomorrow');
      return t('forms.cred.expiry.inDays', { days });
    }
    case 'valid':
      return until ? t('forms.cred.expiry.validUntil', { date: until }) : t('forms.cred.expiry.noExpiry');
    default:
      return t('forms.cred.expiry.missing');
  }
}

/** Read-only text of a credential value ("Yes, level: B, obtained: …, until: …"); `null` = not held. */
export function credentialSummary(
  value: unknown,
  options: { value: string; label: string }[] | null,
  texts: { yes: string; level: (level: string) => string; obtained: (date: string) => string; until: (date: string) => string; formatDate: (v: string) => string },
): string | null {
  const cred = parseCredential(value);
  if (!cred) return null;
  const parts = [texts.yes];
  if (cred.level) parts.push(texts.level((options ?? []).find((o) => o.value === cred.level)?.label ?? cred.level));
  if (cred.obtainedOn) parts.push(texts.obtained(texts.formatDate(cred.obtainedOn)));
  if (cred.validUntil) parts.push(texts.until(texts.formatDate(cred.validUntil)));
  return parts.join(', ');
}

// --- Credential overview (board / Funktionstraeger) ---

export const OVERVIEW_STATUSES = ['expired', 'expiring', 'valid', 'missing'] as const;
export type OverviewStatus = (typeof OVERVIEW_STATUSES)[number];
export const WITHIN_DAYS_OPTIONS = [30, 90, 180] as const;
export const DEFAULT_WITHIN_DAYS = 90;
export const OVERVIEW_PAGE_SIZE = 25;
/** Backend limits of the overview query (`page` <= 1000, `pageSize` <= 100): larger values would be answered with 422. */
export const OVERVIEW_MAX_PAGE = 1000;
export const OVERVIEW_MAX_PAGE_SIZE = 100;

export interface OverviewQuery {
  fieldKey: string | null;
  status: OverviewStatus | null;
  withinDays: number;
  page: number;
}

export const DEFAULT_OVERVIEW_QUERY: OverviewQuery = { fieldKey: null, status: null, withinDays: DEFAULT_WITHIN_DAYS, page: 1 };

/** `status = missing` only makes sense for one field (the server answers `422 field_key_required` otherwise): it is dropped without one. */
export function normalizeOverviewQuery(q: OverviewQuery): OverviewQuery {
  const status = q.status === 'missing' && !q.fieldKey ? null : q.status;
  return { fieldKey: q.fieldKey || null, status, withinDays: q.withinDays, page: Math.min(OVERVIEW_MAX_PAGE, Math.max(1, Math.floor(q.page) || 1)) };
}

/** Request path of one overview page; everything is URL-encoded. */
export function overviewPath(clubId: string, query: OverviewQuery, pageSize: number = OVERVIEW_PAGE_SIZE): string {
  const q = normalizeOverviewQuery(query);
  const parts = [`clubId=${encodeURIComponent(clubId)}`];
  if (q.fieldKey) parts.push(`fieldKey=${encodeURIComponent(q.fieldKey)}`);
  if (q.status) parts.push(`status=${q.status}`);
  parts.push(`withinDays=${q.withinDays}`, `page=${q.page}`, `pageSize=${Math.min(OVERVIEW_MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize) || OVERVIEW_PAGE_SIZE))}`);
  return `/club-members/credentials?${parts.join('&')}`;
}

export interface CredentialOverviewField {
  id: string;
  key: string;
  label: string;
  /** Built-in DE/EN texts when the backend sends them (`null`/absent = show `label`). */
  translations?: TextTranslations;
  sensitive: boolean;
  options: { value: string; label: string }[] | null;
  /** Number of stored values; `null` for sensitive definitions (never shown as 0), absent on an older backend. */
  valueCount?: number | null;
}

export interface CredentialOverviewRow {
  clubMemberId: string;
  displayName: string | null;
  fieldKey: string;
  fieldLabel: string;
  translations?: TextTranslations;
  sensitive: boolean;
  value: unknown;
  updatedAt: string | null;
  expiry: CredentialExpiry;
  enteredBy?: EnteredBy | null;
}

export interface CredentialOverviewResponse {
  data: CredentialOverviewRow[];
  page: number;
  pageSize: number;
  total: number;
  today: string;
  withinDays: number;
  fields: CredentialOverviewField[];
}

/** Count text helper: `null`/`undefined` (hidden for sensitive definitions) is not a number and renders as an em dash, never as 0. */
export const formatValueCount = (count: number | null | undefined): string => (typeof count === 'number' && Number.isFinite(count) ? String(count) : '—');

export const overviewPageCount = (total: number, pageSize: number = OVERVIEW_PAGE_SIZE): number => Math.max(1, Math.ceil(total / pageSize));
