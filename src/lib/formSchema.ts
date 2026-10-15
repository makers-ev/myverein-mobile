import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';

/**
 * Pure helpers of the form builder's applicant side (Wave 8 M1/M2, ported 1:1 from the website's formSchema.ts): field types as the backend sends them
 * (`GET /club-forms/:clubSlug/aufnahme`, backend `src/lib/form-schema.ts`), the visibility rule, a client-side
 * validation that mirrors the server (convenience only -- the server is the authority), answer diffing for the
 * draft autosave and the mapping of backend errors onto translation keys.
 */

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'checkbox', 'consent', 'file', 'image', 'info'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type PatternPreset = 'email' | 'postal_code' | 'phone';

/** Same presets as the backend (`PATTERN_PRESETS`); there is no free regex. */
export const PATTERN_PRESETS: Record<PatternPreset, RegExp> = {
  email: /^[^\s@]{1,64}@[^\s@.]{1,255}(?:\.[^\s@.]{1,63}){1,10}$/,
  postal_code: /^\d{5}$/,
  phone: /^\+?[0-9 ()/-]{5,25}$/,
};

export interface VisibleIf {
  fieldKey: string;
  op: 'eq' | 'neq' | 'in' | 'checked';
  value?: string | number | boolean | string[];
}

export interface FormField {
  key: string;
  type: FieldType;
  label: string;
  helpText?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    minDate?: string;
    maxDate?: string;
    pattern?: PatternPreset;
  };
  visibleIf?: VisibleIf;
  infoKind?: 'privacy_notice';
  text?: string;
  sensitive?: boolean;
}

/** The applicant view of a form version (`data` of `GET /club-forms/:clubSlug/aufnahme`). */
export interface FormDefinition {
  formId: string;
  formVersionId: string;
  version: number;
  purpose: string;
  name: string;
  privacyNotice: string | null;
  childApplication: boolean;
  fields: FormField[];
}

export type Answers = Record<string, unknown>;

/** Uploaded file of a submission (`files[]` of the submission DTO). `url` is a short-lived signed URL, only for images. */
export interface FormFile {
  id: string;
  fieldKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  url: string | null;
}

export type FieldErrorCode =
  | 'unknown_field'
  | 'required'
  | 'invalid_type'
  | 'invalid_value'
  | 'too_short'
  | 'too_long'
  | 'too_small'
  | 'too_large'
  | 'invalid_format'
  | 'not_an_option'
  // client only
  | 'file_type'
  | 'file_size'
  | 'file_failed';

export const FIELD_ERROR_CODES: readonly FieldErrorCode[] = [
  'unknown_field',
  'required',
  'invalid_type',
  'invalid_value',
  'too_short',
  'too_long',
  'too_small',
  'too_large',
  'invalid_format',
  'not_an_option',
  'file_type',
  'file_size',
  'file_failed',
];

export function isFieldErrorCode(value: unknown): value is FieldErrorCode {
  return typeof value === 'string' && (FIELD_ERROR_CODES as readonly string[]).includes(value);
}

export const isFileField = (f: Pick<FormField, 'type'>) => f.type === 'file' || f.type === 'image';
/** Fields that carry a value in `answers` (files live in `files`, `info` is display only). */
export const isAnswerField = (f: Pick<FormField, 'type'>) => f.type !== 'info' && f.type !== 'file' && f.type !== 'image';

export function isEmptyAnswer(value: unknown): boolean {
  return value === undefined || value === null || value === false || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function conditionHolds(field: FormField, values: Answers, visible: ReadonlySet<string>): boolean {
  const cond = field.visibleIf;
  if (!cond) return true;
  // A field behind a hidden field is hidden too.
  if (!visible.has(cond.fieldKey)) return false;
  const rawActual = Object.prototype.hasOwnProperty.call(values, cond.fieldKey) ? values[cond.fieldKey] : undefined;
  // The server evaluates conditions on trimmed answers.
  const actual = typeof rawActual === 'string' ? rawActual.trim() : rawActual;
  switch (cond.op) {
    case 'checked':
      return actual === true;
    case 'eq':
      return !isEmptyAnswer(actual) && actual === cond.value;
    case 'neq':
      return actual !== cond.value;
    case 'in': {
      const allowed = Array.isArray(cond.value) ? cond.value : [];
      if (Array.isArray(actual)) return actual.some((a) => typeof a === 'string' && allowed.includes(a));
      return typeof actual === 'string' && allowed.includes(actual);
    }
    default:
      return false;
  }
}

/** Keys of the answerable fields (and files) whose `visibleIf` holds for `answers`; mirrors the server's `visibleFieldKeys`. */
export function visibleFieldKeys(fields: readonly FormField[], answers: unknown): Set<string> {
  const values: Answers = isPlainObject(answers) ? answers : {};
  const visible = new Set<string>();
  for (const field of fields) {
    if (field.type === 'info') continue;
    if (conditionHolds(field, values, visible)) visible.add(field.key);
  }
  return visible;
}

/** Whether a field (incl. `info` blocks) is shown: `info` blocks follow their own condition against the visible answers. */
export function visibleFields(fields: readonly FormField[], answers: unknown): FormField[] {
  const values: Answers = isPlainObject(answers) ? answers : {};
  const visible = visibleFieldKeys(fields, values);
  return fields.filter((f) => (f.type === 'info' ? conditionHolds(f, values, visible) : visible.has(f.key)));
}

/**
 * Index to insert the form's privacy notice before (`fields.length` = at the end), or `null` if it is already carried by an
 * `info` field of kind `privacy_notice` without own text (that field then shows the notice) or if there is none. The notice
 * is shown right above the first consent so the person reads it before agreeing.
 */
export function privacyNoticeIndex(fields: readonly FormField[], privacyNotice: string | null | undefined): number | null {
  if (!privacyNotice || privacyNotice.trim() === '') return null;
  if (fields.some((f) => f.type === 'info' && f.infoKind === 'privacy_notice' && !(f.text ?? '').trim())) return null;
  const consent = fields.findIndex((f) => f.type === 'consent');
  return consent >= 0 ? consent : fields.length;
}

/** `String.prototype.isWellFormed` is not available in every Hermes build: no unpaired surrogates. */
function isWellFormed(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return false;
    }
  }
  return true;
}

const FORBIDDEN_RANGES: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x061c, 0x061c],
  [0x200e, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];

/**
 * Mirror of the server's character policy for typed answers: no control characters (tab/newline/CR only in multi-line text),
 * no bidi marks/overrides/isolates, no line/paragraph separators and no unpaired surrogates. `<` and `>` are allowed (answers
 * are rendered as text everywhere).
 */
export function isCleanText(value: string, multiline = false): boolean {
  if (!isWellFormed(value)) return false;
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    if (multiline && (cp === 0x09 || cp === 0x0a || cp === 0x0d)) continue;
    if (FORBIDDEN_RANGES.some(([from, to]) => cp >= from && cp <= to)) return false;
  }
  return true;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function cleanValue(field: FormField, value: unknown): FieldErrorCode | null {
  const v = field.validation;
  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return 'invalid_type';
      const text = value.trim();
      const hardMax = field.type === 'text' ? 200 : 5000;
      if (text.length > Math.min(v?.maxLength ?? hardMax, hardMax)) return 'too_long';
      if (text.length < (v?.minLength ?? 0)) return 'too_short';
      if (!isCleanText(text, field.type === 'textarea')) return 'invalid_value';
      if (v?.pattern && PATTERN_PRESETS[v.pattern] && !PATTERN_PRESETS[v.pattern].test(text)) return 'invalid_format';
      return null;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'invalid_type';
      if (v?.min !== undefined && value < v.min) return 'too_small';
      if (v?.max !== undefined && value > v.max) return 'too_large';
      return null;
    }
    case 'date': {
      if (typeof value !== 'string') return 'invalid_type';
      if (!isIsoDate(value)) return 'invalid_value';
      if (v?.minDate !== undefined && value < v.minDate) return 'too_small';
      if (v?.maxDate !== undefined && value > v.maxDate) return 'too_large';
      return null;
    }
    case 'select': {
      if (typeof value !== 'string') return 'invalid_type';
      return (field.options ?? []).some((o) => o.value === value) ? null : 'not_an_option';
    }
    case 'multiselect': {
      if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) return 'invalid_type';
      if (new Set(value).size !== value.length) return 'invalid_value';
      return (value as string[]).every((x) => (field.options ?? []).some((o) => o.value === x)) ? null : 'not_an_option';
    }
    case 'checkbox':
    case 'consent':
      return typeof value === 'boolean' ? null : 'invalid_type';
    default:
      return 'invalid_value';
  }
}

export interface ValidateOptions {
  /** `draft` skips the required checks; `submit` enforces them. */
  mode: 'draft' | 'submit';
  /** Field keys of file/image fields that already have an uploaded file. */
  uploadedFieldKeys?: ReadonlySet<string>;
}

/**
 * Client-side mirror of the backend's `validateAnswers`: hidden fields are skipped and never required, empty values are
 * "not answered", required checkboxes/consents must be `true`, required file fields need an upload. Convenience only; the
 * server decides. Returns `{ fieldKey: code }` (empty = fine).
 */
export function validateAnswers(fields: readonly FormField[], answers: Answers, options: ValidateOptions): Record<string, FieldErrorCode> {
  const errors: Record<string, FieldErrorCode> = {};
  const visible = new Set<string>();
  for (const field of fields) {
    if (field.type === 'info') continue;
    if (!conditionHolds(field, answers, visible)) continue;
    visible.add(field.key);
    if (isFileField(field)) {
      if (options.mode === 'submit' && field.required && !options.uploadedFieldKeys?.has(field.key)) errors[field.key] = 'required';
      continue;
    }
    const raw = Object.prototype.hasOwnProperty.call(answers, field.key) ? answers[field.key] : undefined;
    const boolField = field.type === 'checkbox' || field.type === 'consent';
    if (isEmptyAnswer(raw) || (raw === false && boolField && !field.required)) {
      if (options.mode === 'submit' && field.required) errors[field.key] = 'required';
      continue;
    }
    const problem = cleanValue(field, raw);
    if (problem) {
      errors[field.key] = problem;
      continue;
    }
    if (boolField && field.required && raw !== true && options.mode === 'submit') errors[field.key] = 'required';
  }
  return errors;
}

/** Answers reduced to the keys of answerable fields that are currently visible (what the server would keep). */
export function visibleAnswers(fields: readonly FormField[], answers: Answers): Answers {
  const visible = visibleFieldKeys(fields, answers);
  const out: Answers = {};
  for (const field of fields) {
    if (!isAnswerField(field) || !visible.has(field.key)) continue;
    if (Object.prototype.hasOwnProperty.call(answers, field.key) && !isEmptyAnswer(answers[field.key])) out[field.key] = answers[field.key];
  }
  return out;
}

/** Strings are compared trimmed: the server stores them trimmed, so an untouched answer is not sent again. */
const normalize = (v: unknown): unknown => (typeof v === 'string' ? v.trim() : v);
const sameValue = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

/**
 * The PATCH body for `/form-submissions/:id`: keys whose value differs between the last saved state and the current one.
 * An emptied answer is sent as `null` (the server removes the key); unchanged keys are not sent. Keys in `skip` are left
 * out (answers the server just refused until the person changes them).
 */
export function diffAnswers(saved: Answers, current: Answers, skip: ReadonlySet<string> = new Set()): Answers {
  const patch: Answers = {};
  const keys = new Set([...Object.keys(saved), ...Object.keys(current)]);
  for (const key of keys) {
    if (skip.has(key)) continue;
    const before = Object.prototype.hasOwnProperty.call(saved, key) && !isEmptyAnswer(saved[key]) ? saved[key] : undefined;
    const after = Object.prototype.hasOwnProperty.call(current, key) && !isEmptyAnswer(current[key]) ? current[key] : undefined;
    if (before === undefined && after === undefined) continue;
    if (after === undefined) patch[key] = null;
    else if (!sameValue(before, after)) patch[key] = after;
  }
  return patch;
}

/** Applies a PATCH body to a baseline (`null` removes the key); the result is what the server stores. */
export function applyPatch(base: Answers, patch: Answers): Answers {
  const out: Answers = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else out[key] = value;
  }
  return out;
}

/**
 * Carries local answers over to a new form definition (after `FORM_VERSION_OUTDATED`): only keys of answerable fields of the
 * new definition survive; `dropped` are the keys that did not (or that the server dropped).
 */
export function carryAnswers(newFields: readonly FormField[], answers: Answers, serverDropped: readonly string[] = []): { answers: Answers; dropped: string[] } {
  const answerable = new Set(newFields.filter(isAnswerField).map((f) => f.key));
  const out: Answers = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(answers)) {
    if (isEmptyAnswer(value)) continue;
    if (answerable.has(key) && !serverDropped.includes(key)) out[key] = value;
    else dropped.push(key);
  }
  return { answers: out, dropped };
}

/** Labels (from the OLD definition) of dropped answer keys, falling back to the key. */
export function droppedLabels(oldFields: readonly FormField[], keys: readonly string[]): string[] {
  const byKey = new Map(oldFields.map((f) => [f.key, f.label]));
  return [...new Set(keys)].map((k) => byKey.get(k) ?? k);
}

/**
 * Entries the person has to look at after the form moved to a new version: answers that were dropped and are NOT present in
 * the final answers (an answer that was sent again in the same patch is not lost) plus fields whose uploaded files were
 * removed (field removed, or its type changed). Labels come from the old definition.
 */
export function lostEntryLabels(input: {
  oldFields: readonly FormField[];
  droppedKeys: readonly string[];
  finalAnswers: Answers;
  oldFiles: readonly FormFile[];
  newFiles: readonly FormFile[];
}): string[] {
  const lostAnswers = input.droppedKeys.filter((k) => !(Object.prototype.hasOwnProperty.call(input.finalAnswers, k) && !isEmptyAnswer(input.finalAnswers[k])));
  const kept = new Set(input.newFiles.map((f) => f.id));
  const lostFileFields = input.oldFiles.filter((f) => !kept.has(f.id)).map((f) => f.fieldKey);
  return droppedLabels(input.oldFields, [...lostAnswers, ...lostFileFields]);
}

/**
 * Answers after an asynchronous step (re-pin) finished: `base` is the computed result, but keys the person changed since
 * `snapshot` was taken keep their newest value (or stay removed) as long as the new definition still has the field.
 */
export function mergeConcurrentEdits(snapshot: Answers, latest: Answers, base: Answers, newFields: readonly FormField[]): Answers {
  const answerable = new Set(newFields.filter(isAnswerField).map((f) => f.key));
  const out: Answers = { ...base };
  for (const key of new Set([...Object.keys(snapshot), ...Object.keys(latest)])) {
    const before = isEmptyAnswer(snapshot[key]) ? undefined : snapshot[key];
    const after = isEmptyAnswer(latest[key]) ? undefined : latest[key];
    if (sameValue(before, after) || !answerable.has(key)) continue;
    if (after === undefined) delete out[key];
    else out[key] = latest[key];
  }
  return out;
}

/** Field errors of a `422` (`details.fields`: `{ fieldKey: code }`); unknown codes become `invalid_value`. `null` = not a field error. */
export function fieldErrorsFromError(err: unknown): Record<string, FieldErrorCode> | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  const fields = (err.details as { fields?: unknown } | undefined)?.fields;
  if (!isPlainObject(fields)) return null;
  const out: Record<string, FieldErrorCode> = {};
  for (const [key, code] of Object.entries(fields)) out[key] = isFieldErrorCode(code) ? code : 'invalid_value';
  return Object.keys(out).length > 0 ? out : null;
}

/** Translation key of a field error code. */
export const fieldErrorKey = (code: FieldErrorCode): string => `forms.err.field.${code}`;

export interface OutdatedInfo {
  /** The definition the client has to re-render; `null` = the club currently has no application form. */
  current: FormDefinition | null;
  submissionId: string | null;
}

/** `409 FORM_VERSION_OUTDATED` with the current definition (`details.currentVersion`), or `null` for any other error. */
export function outdatedFrom(err: unknown): OutdatedInfo | null {
  if (!(err instanceof ApiError) || err.status !== 409 || err.code !== 'FORM_VERSION_OUTDATED') return null;
  const d = err.details as { currentVersion?: unknown; submissionId?: unknown } | undefined;
  const cur = d?.currentVersion;
  const valid = isPlainObject(cur) && typeof cur.formVersionId === 'string' && Array.isArray(cur.fields);
  return { current: valid ? (cur as unknown as FormDefinition) : null, submissionId: typeof d?.submissionId === 'string' ? d.submissionId : null };
}

const DETAIL_CODE_KEYS: Record<string, string> = {
  draft_limit: 'forms.err.draftLimit',
  draft_limit_user: 'forms.err.draftLimitUser',
  draft_upload_cap: 'forms.err.draftUploadCap',
  club_quota: 'forms.err.clubQuota',
  unattached_cap: 'forms.err.unattachedCap',
  child_application_limit: 'forms.err.childLimit',
  club_child_application_limit: 'forms.err.clubChildLimit',
  child_application_unsupported: 'forms.err.childUnsupported',
  email_not_verified: 'forms.err.emailNotVerified',
  guardian_not_active: 'forms.err.guardianNotActive',
  form_required: 'forms.err.formRequired',
  member_rejoin_blocked: 'forms.err.rejoinBlocked',
  submission_not_editable: 'forms.err.notEditable',
  submission_not_withdrawable: 'forms.err.notWithdrawable',
  application_withdrawn: 'forms.err.applicationWithdrawn',
  decision_busy: 'forms.err.decisionBusy',
};

/**
 * Translation key for a failed form request (draft, upload, submit, withdraw, review decision). Known `details.code`s get
 * their own plain text; `422` with `details.fields` says "check your entries"; a changed form version has its own text;
 * everything else falls back to the shared member error texts (`api.error.*`, see `apiErrorKey`). The server's English messages never reach the
 * user.
 */
export function formErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'FORM_VERSION_OUTDATED') return 'forms.err.outdated';
    const code = (err.details as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(DETAIL_CODE_KEYS, code)) return DETAIL_CODE_KEYS[code]!;
    if (err.status === 422 && fieldErrorsFromError(err)) return 'forms.err.fieldsInvalid';
    if (err.status === 413) return 'forms.err.fileSize';
    if (err.status === 422) {
      const m = err.message;
      if (/exceeds maximum size/i.test(m)) return 'forms.err.fileSize';
      if (/unsupported file type|does not match/i.test(m)) return 'forms.err.fileType';
      if (/at most \d+ files/i.test(m)) return 'forms.err.fileCount';
      if (/too large|body too large/i.test(m)) return 'forms.err.fileSize';
      if (/Missing file|fieldKey/i.test(m)) return 'forms.err.fileMissing';
    }
    if (err.code === 'ALREADY_MEMBER') return 'api.error.already-member';
    if (err.code === 'APPLICATION_PENDING') return 'forms.err.applicationPending';
  }
  return apiErrorKey(err);
}

export type OnBehalfOf = 'self' | 'guardian';

/** A submission as the applicant routes return it (`submission` of `/form-submissions`). */
export interface Submission {
  id: string;
  formVersionId: string;
  onBehalfOf: OnBehalfOf;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'withdrawn';
  answers: Answers;
  files: FormFile[];
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

/** An entry of `GET /form-submissions/mine`. */
export interface MySubmission extends Submission {
  purpose: string;
  version: number;
  club: { id: string; name: string; slug: string };
}

/** The newest open draft (per `onBehalfOf`) and the pending (submitted, undecided) applications of one club's application form. */
export function selectApplicationState(mine: readonly MySubmission[], slug: string): { drafts: Partial<Record<OnBehalfOf, MySubmission>>; submitted: MySubmission[] } {
  const own = mine.filter((m) => m.purpose === 'aufnahme' && m.club.slug === slug);
  const newestFirst = [...own].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const drafts: Partial<Record<OnBehalfOf, MySubmission>> = {};
  for (const m of newestFirst) if (m.status === 'draft' && !drafts[m.onBehalfOf]) drafts[m.onBehalfOf] = m;
  return { drafts, submitted: newestFirst.filter((m) => m.status === 'submitted') };
}

/** Which applicant modes are open: one pending application for oneself blocks another; the child mode needs `childApplication`. */
export function allowedModes(definition: Pick<FormDefinition, 'childApplication'>, submitted: readonly Pick<Submission, 'onBehalfOf'>[]): OnBehalfOf[] {
  const modes: OnBehalfOf[] = [];
  if (!submitted.some((s) => s.onBehalfOf === 'self')) modes.push('self');
  if (definition.childApplication) modes.push('guardian');
  return modes;
}

/** Warnings of a child application (`warnings[]` of submit / review) with their translation key. */
export const CHILD_WARNINGS = ['child_is_adult', 'birth_date_missing', 'child_name_matches_guardian'] as const;
export type ChildWarning = (typeof CHILD_WARNINGS)[number];

export function childWarningKey(warning: unknown): string | null {
  return typeof warning === 'string' && (CHILD_WARNINGS as readonly string[]).includes(warning) ? `forms.warn.${warning}` : null;
}

/**
 * Client-side file check for the mobile app: only photos can be picked (`expo-image-picker`), so a `file` field takes
 * JPEG/PNG (PDF needs the website, plan open point O5) and an `image` field JPEG/PNG/WebP, at most 10 MB. The backend
 * re-checks magic bytes, type per field and size (5 MB for a profile photo).
 */
export const IMAGE_FIELD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const FILE_FIELD_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const FILE_FIELD_MAX_BYTES = 10 * 1024 * 1024;

export function checkFieldFile(field: Pick<FormField, 'type'>, file: { type: string; size?: number | null }): FieldErrorCode | null {
  const allowed: readonly string[] = field.type === 'image' ? IMAGE_FIELD_MIME_TYPES : FILE_FIELD_PHOTO_MIME_TYPES;
  if (!allowed.includes(file.type)) return 'file_type';
  if (file.size != null && (file.size <= 0 || file.size > FILE_FIELD_MAX_BYTES)) return 'file_size';
  return null;
}

/** Human readable size (`1,2 MB`), not locale-sensitive beyond the decimal separator. */
export function formatBytes(bytes: number, language = 'de'): string {
  const nf = (n: number) => n.toLocaleString(language === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${nf(bytes / 1024)} KB`;
  return `${nf(bytes / (1024 * 1024))} MB`;
}

/** Kind of a `POST /form-submissions` / apply conflict (`409` with `error.code`); `other` = a 409 without a known code. */
export type ApplyConflict = 'already_member' | 'application_pending' | 'other';

export function applyConflictKind(err: unknown): ApplyConflict | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  if (err.code === 'ALREADY_MEMBER') return 'already_member';
  if (err.code === 'APPLICATION_PENDING') return 'application_pending';
  return 'other';
}

/** Percentage 0..100 of an upload progress; `null` if the total is unknown. */
export function progressPercent(sent: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((sent / total) * 100)));
}

/** `403 email_not_verified`: a child application needs a verified e-mail address of the parent. */
export function isEmailNotVerified(err: unknown): boolean {
  return err instanceof ApiError && (err.details as { code?: unknown } | undefined)?.code === 'email_not_verified';
}
