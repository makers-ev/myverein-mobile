import { ApiError } from './api';
import { formErrorKey } from './formSchema';

/**
 * Types and pure helpers of the board's review of applications (Wave 8 M3, ported from the website's applicationReview.ts): `GET /club-applications` (page of list rows
 * with a short answer summary) and `GET /club-applications/:id` (answers rendered against the version the person filled in).
 */

export const APPLICATIONS_PAGE_SIZE = 10;

export interface AnswerSummaryItem {
  key: string;
  label: string;
  display: string;
}

/** Row of `GET /club-applications`. `birthDate` is `null` without `members:read_sensitive`. */
export interface ClubApplication {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  category: string | null;
  birthDate: string | null;
  status: string;
  onBehalfOf: 'self' | 'guardian';
  createdAt: string;
  formSubmissionId: string | null;
  /** Filed before the form builder (or by an old client): category and birth date only. */
  legacy: boolean;
  /** The person the application is for (the child for a child application). */
  subjectName: string | null;
  summary: AnswerSummaryItem[];
  fileCount: number;
  /** `null` = no consent record (legacy). */
  consentGiven: boolean | null;
}

export interface ApplicationPage {
  data: ClubApplication[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RenderedAnswer {
  key: string;
  label: string;
  type: string;
  required: boolean;
  sensitive: boolean;
  /** Protected and the caller may not read it: no value. */
  redacted: boolean;
  answered: boolean;
  value: unknown;
  display: string | string[] | boolean | number | null;
}

export interface MappingEntry {
  fieldKey: string;
  fieldLabel: string;
  kind: 'master' | 'category' | 'photo' | 'custom' | 'none';
  target: string | null;
  customFieldKey: string | null;
  targetLabel: string | null;
  willApply: boolean;
  reason?: string;
}

export interface ReviewFile {
  id: string;
  fieldKey: string;
  fieldLabel: string | null;
  kind: string;
  sensitive: boolean;
  redacted: boolean;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Authenticated retrieval path (fetch with the session cookie); `null` when protected. Never a public URL. */
  path: string | null;
}

export interface DuplicateHint {
  clubMemberId: string;
  displayName: string;
  matches: ('name_birth_date' | 'email')[];
}

export interface ApplicationReview {
  application: { id: string; status: string; onBehalfOf: 'self' | 'guardian'; legacy: boolean; createdAt: string; decidedAt: string | null; category: string; birthDate: string | null };
  applicant: { userId: string; name: string; email: string };
  subject: { displayName: string | null; birthDate: string | null; ageYears: number | null; ageBand: '<18' | '>=18' | null; isMinor: boolean | null };
  form: { version: number; name: string; privacyNotice: string | null } | null;
  answers: RenderedAnswer[];
  answersRetained: boolean;
  mapping: { preview: boolean; entries: MappingEntry[] };
  files: ReviewFile[];
  consent: {
    consentFieldKeys: string[];
    textSha256: string;
    consentedAt: string | null;
    role: 'self' | 'guardian';
    givenBy: { userId: string; name: string };
    fields: { key: string; label: string; given: boolean }[];
    privacyNoticeShown: boolean;
  } | null;
  duplicates: DuplicateHint[];
  warnings: string[];
  decision: { decidedAt: string | null; decisionNote: string | null; internalNote: string | null } | null;
}

export interface MappingReport {
  applied: string[];
  customFields: number;
  skipped: { fieldKey: string; reason: string }[];
}

/** Result of `POST /club-applications/:id/approve`. */
export interface ApproveResult {
  application: { id: string };
  mapping?: MappingReport;
  guardian?: { name?: string | null } | null;
}

export function listQuery(clubId: string, page: number, pageSize = APPLICATIONS_PAGE_SIZE): string {
  return `clubId=${encodeURIComponent(clubId)}&page=${Math.max(1, Math.trunc(page))}&pageSize=${pageSize}`;
}

/** Page to show after a reload: the requested one, or the last existing page when decisions emptied it. */
export function clampPage(page: number, total: number, pageSize = APPLICATIONS_PAGE_SIZE): number {
  const last = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return Math.min(Math.max(1, page), last);
}

/** Body of the approve call: only an explicit category choice is sent (`categoryId`), otherwise the applicant's wish stands. */
export function approveBody(categoryId: string): { categoryId: string } | undefined {
  return categoryId ? { categoryId } : undefined;
}

export const NOTE_MAX_LENGTH = 1000;

/** Body of the reject call: the internal note stays with the board, `applicantMessage` is shown to the applicant; empty texts are omitted. */
export function rejectBody(note: string, applicantMessage: string): { note?: string; applicantMessage?: string } {
  const n = note.trim();
  const m = applicantMessage.trim();
  return { ...(n ? { note: n } : {}), ...(m ? { applicantMessage: m } : {}) };
}

/** Text of an answer for the review list: option labels already resolved by the server; booleans as yes/no. */
export function answerText(answer: Pick<RenderedAnswer, 'answered' | 'display'>, t: (key: string) => string): string {
  if (!answer.answered || answer.display === null || answer.display === undefined) return '—';
  if (typeof answer.display === 'boolean') return t(answer.display ? 'forms.review.yes' : 'forms.review.no');
  if (Array.isArray(answer.display)) return answer.display.join(', ');
  return String(answer.display);
}

const MAPPING_REASONS = new Set([
  'not_answered',
  'no_file',
  'unknown_target',
  'type_mismatch',
  'not_a_text',
  'invalid_value',
  'custom_field_unknown',
  'custom_field_archived',
  'custom_field_type_mismatch',
  'custom_field_not_sensitive',
]);

/** Translation key for why a mapping entry will not be applied; unknown reasons get the generic text. */
export function mappingReasonKey(reason: string | undefined): string {
  return reason && MAPPING_REASONS.has(reason) ? `forms.review.mapping.reason.${reason}` : 'forms.review.mapping.reason.other';
}

const MAPPING_TARGETS = new Set([
  'firstName',
  'lastName',
  'birthDate',
  'street',
  'postalCode',
  'city',
  'phone',
  'contactEmail',
  'emergencyContactName',
  'emergencyContactPhone',
  'category',
  'photo',
]);

/** Name of the target of a mapping entry: the translated allowlist target, or the custom field's label/key. `null` = not mapped. */
export function mappingTargetText(entry: MappingEntry, t: (key: string, params?: Record<string, string | number>) => string): string | null {
  if (entry.target && MAPPING_TARGETS.has(entry.target)) return t(`forms.review.target.${entry.target}`);
  if (entry.kind === 'custom') {
    // The server label reads `Zusatzfeld „Label“`; the label is data, the frame is translated.
    const match = /„(.+)“/.exec(entry.targetLabel ?? '');
    return t('forms.review.target.custom', { name: match?.[1] ?? entry.customFieldKey ?? '' });
  }
  return null;
}

export function duplicateKindKey(matches: DuplicateHint['matches']): string {
  const name = matches.includes('name_birth_date');
  const mail = matches.includes('email');
  if (name && mail) return 'forms.review.duplicate.both';
  return mail ? 'forms.review.duplicate.email' : 'forms.review.duplicate.name';
}

const REVIEW_WARNINGS = new Set(['child_is_adult', 'birth_date_missing', 'child_name_matches_guardian']);

export function reviewWarningKey(warning: unknown): string | null {
  return typeof warning === 'string' && REVIEW_WARNINGS.has(warning) ? `forms.review.warn.${warning}` : null;
}

/** Short hash for the consent evidence (the full SHA-256 is long; 12 characters identify the text state). */
export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

/**
 * The list is stale only if the application is gone (404), was withdrawn (`application_withdrawn`) or already decided.
 * A busy decision (`decision_busy`) or "already a member" is a hint, not staleness: the buttons stay (retry / reject still possible).
 */
export function isStaleDecision(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404) return true;
  if (err.status !== 409) return false;
  const code = (err.details as { code?: unknown } | undefined)?.code;
  if (code === 'application_withdrawn') return true;
  if (code === 'decision_busy') return false;
  return /already been decided/i.test(err.message);
}

/** Translation key for a failed review request (load or decision). */
export function reviewErrorKey(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    const code = (err.details as { code?: unknown } | undefined)?.code;
    if (code === 'application_withdrawn' || code === 'decision_busy') return formErrorKey(err);
    if (/already been decided/i.test(err.message)) return 'forms.review.err.decided';
    if (/already a member/i.test(err.message)) return 'forms.review.err.alreadyMember';
  }
  if (err instanceof ApiError && err.status === 404) return 'forms.review.err.gone';
  if (err instanceof ApiError && err.status === 422 && /unknown or archived category/i.test(err.message)) return 'forms.review.err.category';
  return formErrorKey(err);
}

/**
 * A review file `path` is `/form-submissions/<submissionId>/files/<fileId>` (authenticated, audited retrieval of the media
 * layer). The session cookie is only ever sent to a path of exactly this shape -- a manipulated value (another route, a
 * full URL, path traversal) is refused.
 */
export function isReviewFilePath(path: string | null | undefined): path is string {
  return typeof path === 'string' && /^\/form-submissions\/[0-9a-f-]{8,64}\/files\/[0-9a-f-]{8,64}$/i.test(path);
}

export type ReviewFileView = 'image' | 'document' | 'protected';

/**
 * How the app can show a review file: images (JPEG/PNG/WebP) are downloaded with the session and shown in the app; other
 * documents (PDF) cannot be opened without a document viewer dependency and stay on the website; files without a `path`
 * are protected (no permission to read them).
 */
export function reviewFileView(file: Pick<ReviewFile, 'path' | 'mimeType' | 'redacted'>): ReviewFileView {
  if (file.redacted || !isReviewFilePath(file.path)) return 'protected';
  return typeof file.mimeType === 'string' && /^image\/(jpeg|png|webp)$/i.test(file.mimeType) ? 'image' : 'document';
}
