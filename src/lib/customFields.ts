import { ApiError } from './api';
import { type CredentialExpiry, credentialSummary, type EnteredBy } from './credentials';
import { type Answers, diffAnswers, type FormField, formErrorKey, isEmptyAnswer } from './formSchema';

/**
 * Pure helpers of the custom fields on a member (Wave 8 M4), ported from the website's `customFields.ts`: the values of one
 * member (`GET/PATCH /club-members/me/custom-fields`, `GET /club-members/:id/custom-fields`), the diff of an edit and the
 * mapping of the server's error codes onto plain texts. The server is the authority for visibility and write rights; the app
 * only renders what it is told and disables what it is told is not allowed. Definitions are board business (website).
 */

export const CUSTOM_FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'checkbox', 'credential'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
export type VisibleTo = 'vorstand' | 'funktionstraeger' | 'mitglied';
export type EditableBy = 'vorstand' | 'self';

export const isChoice = (type: string): boolean => type === 'select' || type === 'multiselect';

/** One field of a member as the custom-fields endpoints return it: definition + value + what the caller may do. */
export interface MemberCustomField {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  /** Choices of a select/multiselect, or the levels of a `credential`. */
  options: { value: string; label: string }[] | null;
  /** Form-engine limits (text length, number range, free-text credential level); absent on an older backend. */
  validation?: FormField['validation'] | null;
  helpText?: string | null;
  visibleTo: VisibleTo;
  editableBy: EditableBy;
  sensitive: boolean;
  sortOrder: number;
  archived: boolean;
  archivedAt: string | null;
  /** The caller may change this value (board with `members:write` [+ `members:read_sensitive`], or the person for `editableBy = self`). */
  editable: boolean;
  value: unknown;
  updatedAt: string | null;
  /** `credential` fields only (`null` otherwise / older backend): status of the saved value, see `lib/credentials.ts`. */
  expiry?: CredentialExpiry | null;
  /** Who entered the saved value (`null` = unknown / no value / older backend). */
  enteredBy?: EnteredBy | null;
}

/** The form-engine view of a custom field so the shared `FormRenderer` can render and edit it. */
export function toFormField(field: MemberCustomField): FormField {
  return {
    key: field.key,
    type: field.type,
    label: field.label,
    ...((isChoice(field.type) || field.type === 'credential') && field.options ? { options: field.options } : {}),
    ...(field.helpText ? { helpText: field.helpText } : {}),
    ...(field.validation ? { validation: field.validation } : {}),
    ...(field.type === 'credential' ? { expiry: field.expiry ?? null } : {}),
  };
}

/**
 * Fields shown as inputs. On the person's own record (`own`) only `editable_by = self` fields qualify: a board-maintained field
 * stays read-only there even if the server flags it editable (the caller may hold `members:write`, but the own-profile route
 * is the self route and would refuse it).
 */
export const editableFields = (fields: readonly MemberCustomField[], own = false): MemberCustomField[] =>
  fields.filter((f) => f.editable && !f.archived && (!own || f.editableBy === 'self'));
export const readOnlyFields = (fields: readonly MemberCustomField[], own = false): MemberCustomField[] => {
  const editable = new Set(editableFields(fields, own).map((f) => f.key));
  return fields.filter((f) => !editable.has(f.key));
};

/**
 * Which fields are shown as inputs and which as plain values. In a read-only view (details of another member) nothing is an
 * input, whatever the server says: board edits stay on the website.
 */
export function partitionFields(
  fields: readonly MemberCustomField[],
  readOnlyView: boolean,
  own = false,
): { editable: MemberCustomField[]; readOnly: MemberCustomField[] } {
  if (readOnlyView) return { editable: [], readOnly: [...fields] };
  return { editable: editableFields(fields, own), readOnly: readOnlyFields(fields, own) };
}

/** Answers (key -> value) of the fields that have a value; empty values are left out like on the server. */
export function valuesToAnswers(fields: readonly MemberCustomField[]): Answers {
  const out: Answers = {};
  for (const f of fields) if (!isEmptyAnswer(f.value)) out[f.key] = f.value;
  return out;
}

/**
 * The write body of a value edit: only the editable fields whose answer changed; a cleared answer is `null` (the server removes
 * the value). Read-only fields are never part of it. `null` = nothing changed.
 */
export function valuesPatch(fields: readonly MemberCustomField[], saved: Answers, current: Answers, own = false): Record<string, unknown> | null {
  const editable = new Set(editableFields(fields, own).map((f) => f.key));
  const restrict = (a: Answers): Answers => Object.fromEntries(Object.entries(a).filter(([k]) => editable.has(k)));
  const patch = diffAnswers(restrict(saved), restrict(current));
  return Object.keys(patch).length === 0 ? null : patch;
}

/** Text of a stored value for the read-only view (option labels instead of values); `null` = no value. */
export function displayValue(
  field: Pick<MemberCustomField, 'type' | 'options' | 'value'>,
  texts: {
    yes: string;
    no: string;
    formatDate: (v: string) => string;
    /** Wording of a credential's parts; plain English fallbacks without it. */
    credential?: { level: (level: string) => string; obtained: (date: string) => string; until: (date: string) => string };
  },
): string | null {
  const { value } = field;
  if (field.type === 'credential') {
    const c = texts.credential;
    return credentialSummary(value, field.options, {
      yes: texts.yes,
      level: c?.level ?? ((l) => `level: ${l}`),
      obtained: c?.obtained ?? ((d) => `obtained: ${d}`),
      until: c?.until ?? ((d) => `until: ${d}`),
      formatDate: texts.formatDate,
    });
  }
  if (isEmptyAnswer(value) && value !== false) return null;
  const label = (v: unknown) => (field.options ?? []).find((o) => o.value === v)?.label ?? String(v);
  switch (field.type) {
    case 'checkbox':
      return value === true ? texts.yes : texts.no;
    case 'select':
      return label(value);
    case 'multiselect':
      return Array.isArray(value) ? value.map(label).join(', ') : label(value);
    case 'date':
      return typeof value === 'string' ? texts.formatDate(value) : String(value);
    default:
      return String(value);
  }
}

/** Translation key for a failed custom field request. The server's English messages never reach the user. */
export function customFieldErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      if (/read_sensitive/i.test(err.message)) return 'forms.cf.err.needsSensitive';
      if (/members:write|permission to change|only be changed by the board/i.test(err.message)) return 'forms.cf.err.cannotEdit';
      return 'forms.cf.err.forbidden';
    }
    if (err.status === 422 && !(err.details && typeof err.details === 'object' && 'fields' in err.details)) return 'forms.cf.err.invalid';
    if (err.status === 404) return 'forms.cf.err.notFound';
  }
  return formErrorKey(err);
}

/** Whether a failed load means "this person has no custom fields at all" (guest, record not readable): nothing to show, no error. */
export const isNoFieldsError = (err: unknown): boolean => err instanceof ApiError && (err.status === 403 || err.status === 404);
