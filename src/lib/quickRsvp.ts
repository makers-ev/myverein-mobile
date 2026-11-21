import { ApiError } from './api';
import { needsDetails, registrationErrorKey, type MyRsvp, type RegistrationInfo } from './eventRegistration';

export type QuickRsvpResult =
  | { kind: 'done'; status: 'angemeldet' | 'warteliste' }
  | { kind: 'already'; status: 'angemeldet' | 'warteliste' }
  | { kind: 'details' }
  | { kind: 'error'; errorKey: string };

export interface QuickRsvpDeps {
  fetchRegistration: () => Promise<Pick<RegistrationInfo, 'form' | 'maxCompanions' | 'open' | 'closedReason'>>;
  fetchMine: () => Promise<Pick<MyRsvp, 'status'> | null>;
  submit: () => Promise<{ status: 'angemeldet' | 'warteliste' }>;
}

/** The server answers 422 with the missing `fields` only for required fields; every other failure is a plain error. */
export function isRequiredFieldsError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 422) return false;
  const fields = (err.details as { fields?: unknown } | undefined)?.fields;
  return !!fields && typeof fields === 'object';
}

/**
 * One-tap sign-up from the Heute hero. Asks first: events with a form or companions need the event sheet, an existing
 * sign-up is never overwritten (a body-less POST would reset party size and answers), and only the required-field 422
 * falls back to the sheet -- everything else becomes an error message.
 */
export async function quickRsvp(deps: QuickRsvpDeps): Promise<QuickRsvpResult> {
  try {
    const info = await deps.fetchRegistration();
    if (info.closedReason) return { kind: 'error', errorKey: 'reg.err.closed' };
    if (needsDetails(info)) return { kind: 'details' };
    const mine = await deps.fetchMine();
    if (mine) return { kind: 'already', status: mine.status };
    const result = await deps.submit();
    return { kind: 'done', status: result.status };
  } catch (err) {
    if (isRequiredFieldsError(err)) return { kind: 'details' };
    return { kind: 'error', errorKey: registrationErrorKey(err) };
  }
}

/** Runs one task at a time: a second call while the first is running is dropped (double tap), not queued. */
export function createSingleFlight() {
  let busy = false;
  return async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (busy) return undefined;
    busy = true;
    try {
      return await task();
    } finally {
      busy = false;
    }
  };
}
