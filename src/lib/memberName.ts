import { ApiError } from './api';

/** Name fields of the own member record (`PATCH /club-members/me`). */
export const NAME_KEYS = ['firstName', 'lastName', 'displayName'] as const;
export type NameKey = (typeof NAME_KEYS)[number];
export type NameDraft = Record<NameKey, string>;

export const FIRST_LAST_MAX = 100;
export const DISPLAY_NAME_MAX = 200;

export type NameErrorCode = 'too-long' | 'required' | 'invalid';
export type NameErrors = Partial<Record<NameKey, NameErrorCode>>;

interface NameSource {
  name?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Name draft of a member. A backend without the new fields delivers none of them: first/last name read as empty and the
 * display name falls back to `name` (which is the display name in the member shape).
 */
export function nameDraftFromMember(member: NameSource | null | undefined): NameDraft {
  return {
    firstName: member?.firstName ?? '',
    lastName: member?.lastName ?? '',
    displayName: member?.displayName ?? member?.name ?? '',
  };
}

/** Client-side validation (the backend stays authoritative): length limits and a non-empty display name. */
export function validateName(draft: NameDraft): NameErrors {
  const errors: NameErrors = {};
  if (draft.firstName.trim().length > FIRST_LAST_MAX) errors.firstName = 'too-long';
  if (draft.lastName.trim().length > FIRST_LAST_MAX) errors.lastName = 'too-long';
  const display = draft.displayName.trim();
  if (display.length === 0) errors.displayName = 'required';
  else if (display.length > DISPLAY_NAME_MAX) errors.displayName = 'too-long';
  return errors;
}

/** Keys whose trimmed value differs from the server's. */
export function changedNameKeys(draft: NameDraft, server: NameDraft): NameKey[] {
  return NAME_KEYS.filter((k) => draft[k].trim() !== server[k].trim());
}

/**
 * Body for `PATCH /club-members/me`: only changed fields; a cleared first/last name is sent as `null`. The display name
 * is never sent empty (validation blocks that).
 */
export function namePatch(draft: NameDraft, server: NameDraft): Partial<Record<NameKey, string | null>> {
  const body: Partial<Record<NameKey, string | null>> = {};
  for (const k of changedNameKeys(draft, server)) {
    const value = draft[k].trim();
    body[k] = k !== 'displayName' && value === '' ? null : value;
  }
  return body;
}

/** Name fields the backend rejected with `422 details.fields` (value may be a string, an array or anything truthy). */
export function nameFieldErrorsFromApi(err: unknown): NameErrors {
  if (!(err instanceof ApiError) || err.status !== 422) return {};
  const details = err.details;
  if (!details || typeof details !== 'object' || !('fields' in details)) return {};
  const fields = (details as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object') return {};
  const out: NameErrors = {};
  for (const k of NAME_KEYS) {
    if (k in fields) out[k] = 'invalid';
  }
  return out;
}
