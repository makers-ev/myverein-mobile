jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import {
  absolutePublicLink,
  clampPartySize,
  formatCost,
  maxPartySize,
  needsDetails,
  registrationErrorKey,
  registrationFields,
  rsvpBody,
  rsvpPath,
  wardsOfClub,
} from './eventRegistration';
import type { FormDefinition, FormField } from './formSchema';

const field = (key: string, type: FormField['type'], extra: Partial<FormField> = {}): FormField => ({ key, type, label: key, ...extra });
const form = (fields: FormField[]): FormDefinition => ({
  formId: 'f',
  formVersionId: 'v',
  version: 1,
  purpose: 'veranstaltungsanmeldung',
  name: 'x',
  privacyNotice: null,
  childApplication: false,
  fields,
});

describe('registration helpers', () => {
  it('drops file fields and decides whether details are needed', () => {
    const f = form([field('a', 'text'), field('p', 'image'), field('n', 'info')]);
    expect(registrationFields(f).map((x) => x.key)).toEqual(['a', 'n']);
    expect(needsDetails({ form: f, maxCompanions: 0 })).toBe(true);
    expect(needsDetails({ form: form([field('n', 'info')]), maxCompanions: 0 })).toBe(false);
    expect(needsDetails({ form: null, maxCompanions: 0 })).toBe(false);
    expect(needsDetails({ form: null, maxCompanions: 2 })).toBe(true);
  });

  it('limits the party size to the person plus allowed companions', () => {
    expect(maxPartySize({ maxCompanions: 3 })).toBe(4);
    expect(maxPartySize({ maxCompanions: 99 })).toBe(20);
    expect(clampPartySize(9, { maxCompanions: 2 })).toBe(3);
    expect(clampPartySize(0, { maxCompanions: 2 })).toBe(1);
    expect(clampPartySize(Number.NaN, { maxCompanions: 2 })).toBe(1);
  });

  it('sends no body for a plain sign-up and only visible answers otherwise', () => {
    expect(rsvpBody({ form: null, maxCompanions: 0 }, { partySize: 1, answers: {}, forClubMemberId: null })).toBeUndefined();
    const f = form([field('a', 'text'), field('b', 'text', { visibleIf: { fieldKey: 'a', op: 'eq', value: 'x' } })]);
    expect(rsvpBody({ form: f, maxCompanions: 2 }, { partySize: 3, answers: { a: 'y', b: 'hidden', zzz: 1 }, forClubMemberId: 'w1' })).toEqual({
      partySize: 3,
      answers: { a: 'y' },
      forClubMemberId: 'w1',
    });
  });

  it('builds the rsvp path with the subject', () => {
    expect(rsvpPath('e 1', 'c', null)).toBe('/events/e%201/rsvp?clubId=c');
    expect(rsvpPath('e', 'c', 'w/1')).toBe('/events/e/rsvp?clubId=c&forClubMemberId=w%2F1');
  });

  it('maps machine-readable errors to plain-language keys', () => {
    const e = (status: number, details?: unknown) => new ApiError(status, 'X', 'english', details);
    expect(registrationErrorKey(e(409, { code: 'registration_closed' }))).toBe('reg.err.closed');
    expect(registrationErrorKey(e(409, { code: 'party_size_unavailable' }))).toBe('reg.err.party-unavailable');
    expect(registrationErrorKey(e(422, { code: 'companions_not_allowed' }))).toBe('reg.err.companions');
    expect(registrationErrorKey(e(422, { fields: { a: 'required' } }))).toBe('forms.err.fieldsInvalid');
    expect(registrationErrorKey(e(403))).toBe('reg.err.not-allowed');
    expect(registrationErrorKey(e(500))).toBe('api.error.server');
    expect(registrationErrorKey(new Error('x'))).toBe('alert.general-error-description');
  });

  it('formats cost and completes relative links', () => {
    expect(formatCost(500, 'de')).toMatch(/5,00/);
    expect(formatCost(null, 'de')).toBeNull();
    expect(formatCost(-1, 'de')).toBeNull();
    expect(absolutePublicLink('/anmeldung/abc', 'https://verein.example/')).toBe('https://verein.example/anmeldung/abc');
    expect(absolutePublicLink('https://x.test/anmeldung/abc', 'https://verein.example')).toBe('https://x.test/anmeldung/abc');
  });

  it('keeps only wards of the active club', () => {
    expect(wardsOfClub([{ clubId: 'a' }, { clubId: 'b' }], 'b')).toEqual([{ clubId: 'b' }]);
  });
});
