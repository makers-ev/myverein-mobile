import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';
import { isFileField, visibleAnswers, type Answers, type FormDefinition, type FormField } from './formSchema';

/**
 * Wave 12 M5 -- registration with form, party size and "for somebody else". Pure helpers for
 * `GET/PUT /events/:id/registration`, `POST/GET/DELETE /events/:id/rsvp` and the guest link. Cost is display only (no payment
 * through MyVerein); answers are personal data and are never logged or stored on the device.
 */

export interface RegistrationInfo {
  eventId: string;
  calendarId: string;
  enabled: boolean;
  open: boolean;
  closedReason: 'cancelled' | 'deadline_passed' | null;
  deadlineAt: string | null;
  maxCompanions: number;
  allowGuests: boolean;
  costNote: string | null;
  costCents: number | null;
  form: FormDefinition | null;
  /** Needs `calendars:write`. */
  canManage: boolean;
  manage?: { formId: string | null; formVersion: number | null; guestRetentionDays: number; publicLinkActive: boolean };
}

export interface MyRsvp {
  status: 'angemeldet' | 'warteliste';
  partySize: number;
  answers: Answers;
  respondedAt: string | null;
}

export const MAX_PARTY_SIZE = 20;

/** Registration forms have no file fields (the server refuses them); an unexpected one is not offered. */
export function registrationFields(form: Pick<FormDefinition, 'fields'> | null): FormField[] {
  return (form?.fields ?? []).filter((f) => !isFileField(f));
}

/** Does this registration ask for anything (form or companions)? Otherwise one tap registers. */
export function needsDetails(info: Pick<RegistrationInfo, 'form' | 'maxCompanions'>): boolean {
  return registrationFields(info.form).some((f) => f.type !== 'info') || info.maxCompanions > 0;
}

/** Largest group the person may register (themselves plus companions). */
export function maxPartySize(info: Pick<RegistrationInfo, 'maxCompanions'>): number {
  return Math.min(MAX_PARTY_SIZE, 1 + Math.max(0, info.maxCompanions));
}

export function clampPartySize(value: number, info: Pick<RegistrationInfo, 'maxCompanions'>): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(maxPartySize(info), Math.max(1, Math.trunc(value)));
}

/** Body of `POST /events/:id/rsvp`: nothing for a plain sign-up (the old behaviour), answers only of visible fields. */
export function rsvpBody(
  info: Pick<RegistrationInfo, 'form' | 'maxCompanions'>,
  input: { partySize: number; answers: Answers; forClubMemberId: string | null },
): { partySize?: number; answers?: Answers; forClubMemberId?: string } | undefined {
  const body: { partySize?: number; answers?: Answers; forClubMemberId?: string } = {};
  const size = clampPartySize(input.partySize, info);
  if (size > 1) body.partySize = size;
  const fields = registrationFields(info.form);
  if (fields.length > 0) {
    const answers = visibleAnswers(fields, input.answers);
    if (Object.keys(answers).length > 0) body.answers = answers;
  }
  if (input.forClubMemberId) body.forClubMemberId = input.forClubMemberId;
  return Object.keys(body).length > 0 ? body : undefined;
}

export function rsvpPath(eventId: string, clubId: string, forClubMemberId: string | null): string {
  const subject = forClubMemberId ? `&forClubMemberId=${encodeURIComponent(forClubMemberId)}` : '';
  return `/events/${encodeURIComponent(eventId)}/rsvp?clubId=${encodeURIComponent(clubId)}${subject}`;
}

const DETAIL_KEYS: Record<string, string> = {
  registration_closed: 'reg.err.closed',
  party_size_unavailable: 'reg.err.party-unavailable',
  companions_not_allowed: 'reg.err.companions',
  party_too_large: 'reg.err.party-too-large',
  invalid_party_size: 'reg.err.party-too-large',
  no_form: 'reg.err.no-form',
  ward_has_account: 'reg.err.ward-has-account',
  event_cancelled: 'reg.err.cancelled',
  guests_not_allowed: 'reg.err.guests-not-allowed',
};

/** Plain-language key for a failed registration call; server English never reaches the UI. */
export function registrationErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.details as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(DETAIL_KEYS, code)) return DETAIL_KEYS[code]!;
    if (err.status === 422 && (err.details as { fields?: unknown } | undefined)?.fields) return 'forms.err.fieldsInvalid';
    if (err.status === 403) return 'reg.err.not-allowed';
  }
  return apiErrorKey(err);
}

/** "5,00 EUR" style amount for display; `null` without an amount. */
export function formatCost(costCents: number | null | undefined, language: string): string | null {
  if (costCents == null || !Number.isFinite(costCents) || costCents < 0) return null;
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(costCents / 100);
  } catch {
    return `${(costCents / 100).toFixed(2)} EUR`;
  }
}

/** Link of a guest registration; a relative path from the backend is completed with the website base. */
export function absolutePublicLink(url: string, websiteBase: string): string {
  return url.startsWith('/') ? `${websiteBase.replace(/\/$/, '')}${url}` : url;
}

/** Wards of the active club that a parent may register (the backend refuses wards with their own account). */
export function wardsOfClub<T extends { clubId: string }>(wards: readonly T[], clubId: string): T[] {
  return wards.filter((w) => w.clubId === clubId);
}
