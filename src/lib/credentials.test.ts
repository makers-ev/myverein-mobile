jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import {
  buildCredentialValue,
  credentialLevelMode,
  credentialSummary,
  DEFAULT_OVERVIEW_QUERY,
  expiryApplies,
  expiryLabel,
  formatValueCount,
  isUnverifiedSelfEntry,
  normalizeOverviewQuery,
  overviewPageCount,
  overviewPath,
  parseCredential,
} from './credentials';
import { credentialProblem, validateAnswers, type FormField } from './formSchema';

const t = (key: string, params?: Record<string, string | number>) => `${key}${params ? JSON.stringify(params) : ''}`;
const fmt = (v: string) => `<${v}>`;

describe('credentialLevelMode', () => {
  it('picks select, text or none from the definition', () => {
    expect(credentialLevelMode({ options: [{ value: 'a', label: 'A' }] })).toBe('select');
    expect(credentialLevelMode({ validation: { maxLength: 60 } })).toBe('text');
    expect(credentialLevelMode({ options: [] })).toBe('none');
    expect(credentialLevelMode({})).toBe('none');
  });
});

describe('buildCredentialValue', () => {
  it('turns on with a minimal value and clears with undefined', () => {
    expect(buildCredentialValue(undefined, { have: true })).toEqual({ valid: true });
    expect(buildCredentialValue({ valid: true, level: 'b' }, { have: false })).toBeUndefined();
  });
  it('merges patches, drops empty parts and keeps the canonical key order', () => {
    const v = buildCredentialValue({ valid: true, validUntil: '2027-01-01' }, { level: 'B', obtainedOn: '2024-01-01' });
    expect(Object.keys(v!)).toEqual(['valid', 'level', 'obtainedOn', 'validUntil']);
    expect(buildCredentialValue(v, { validUntil: null, level: '  ' })).toEqual({ valid: true, obtainedOn: '2024-01-01' });
  });
  it('treats unexpected stored values as not held', () => {
    expect(parseCredential('x')).toBeNull();
    expect(parseCredential({ valid: false })).toBeNull();
    expect(parseCredential({ valid: true, level: '', validUntil: '' })).toEqual({ valid: true });
  });
});

describe('credential validation', () => {
  const levels = { options: [{ value: 'a', label: 'A' }] };
  it('accepts the contract shape', () => {
    expect(credentialProblem(levels, { valid: true, level: 'a', obtainedOn: '2024-01-31', validUntil: '2027-01-31' })).toBeNull();
    expect(credentialProblem({}, { valid: true })).toBeNull();
  });
  it('reports the server codes', () => {
    expect(credentialProblem({}, 'x')).toBe('invalid_type');
    expect(credentialProblem({}, { valid: false })).toBe('invalid_value');
    expect(credentialProblem({}, { valid: true, extra: 1 })).toBe('invalid_type');
    expect(credentialProblem(levels, { valid: true, level: 'z' })).toBe('not_an_option');
    expect(credentialProblem({ validation: { maxLength: 3 } }, { valid: true, level: 'abcd' })).toBe('too_long');
    expect(credentialProblem({}, { valid: true, level: 'x' })).toBe('invalid_value');
    expect(credentialProblem({}, { valid: true, validUntil: '2027-02-30' })).toBe('invalid_value');
    expect(credentialProblem({}, { valid: true, validUntil: '2101-01-01' })).toBe('invalid_value');
  });
  it('flags a reversed range locally', () => {
    expect(credentialProblem({}, { valid: true, obtainedOn: '2025-05-01', validUntil: '2025-04-30' })).toBe('date_order');
    expect(credentialProblem({}, { valid: true, obtainedOn: '2025-05-01', validUntil: '2025-05-01' })).toBeNull();
  });
  it('is used by validateAnswers and never required', () => {
    const f: FormField = { key: 'q', type: 'credential', label: 'Q' };
    expect(validateAnswers([f], {}, { mode: 'submit' })).toEqual({});
    expect(validateAnswers([f], { q: { valid: true, obtainedOn: '2025-05-02', validUntil: '2025-05-01' } }, { mode: 'draft' })).toEqual({ q: 'date_order' });
  });
});

describe('expiryLabel', () => {
  it('words every status', () => {
    expect(expiryLabel({ status: 'expired', daysLeft: -3, validUntil: '2026-01-01' }, t, fmt)).toBe('forms.cred.expiry.expiredOn{"date":"<2026-01-01>"}');
    expect(expiryLabel({ status: 'expired', daysLeft: -3, validUntil: null }, t, fmt)).toBe('forms.cred.expiry.expired');
    expect(expiryLabel({ status: 'expiring', daysLeft: 12, validUntil: '2026-11-01' }, t, fmt)).toBe('forms.cred.expiry.inDays{"days":12}');
    expect(expiryLabel({ status: 'expiring', daysLeft: 1, validUntil: '2026-11-01' }, t, fmt)).toBe('forms.cred.expiry.tomorrow');
    expect(expiryLabel({ status: 'expiring', daysLeft: 0, validUntil: '2026-11-01' }, t, fmt)).toBe('forms.cred.expiry.today');
    expect(expiryLabel({ status: 'valid', daysLeft: 400, validUntil: '2027-12-01' }, t, fmt)).toBe('forms.cred.expiry.validUntil{"date":"<2027-12-01>"}');
    expect(expiryLabel({ status: 'valid', daysLeft: null, validUntil: null }, t, fmt)).toBe('forms.cred.expiry.noExpiry');
    expect(expiryLabel({ status: 'missing', daysLeft: null, validUntil: null }, t, fmt)).toBe('forms.cred.expiry.missing');
  });
  it('only applies to the saved value', () => {
    const e = { status: 'expiring' as const, daysLeft: 5, validUntil: '2026-11-01' };
    expect(expiryApplies(e, { valid: true, validUntil: '2026-11-01' })).toBe(true);
    expect(expiryApplies(e, { valid: true, validUntil: '2026-12-01' })).toBe(false);
    expect(expiryApplies(null, { valid: true })).toBe(false);
    expect(expiryApplies({ status: 'missing', daysLeft: null, validUntil: null }, undefined)).toBe(true);
  });
});

describe('credentialSummary', () => {
  const texts = { yes: 'Ja', level: (l: string) => `Stufe ${l}`, obtained: (d: string) => `seit ${d}`, until: (d: string) => `bis ${d}`, formatDate: fmt };
  it('joins the parts and resolves level labels', () => {
    expect(credentialSummary({ valid: true, level: 'b', obtainedOn: '2020-01-01', validUntil: '2027-01-01' }, [{ value: 'b', label: 'B' }], texts)).toBe(
      'Ja, Stufe B, seit <2020-01-01>, bis <2027-01-01>',
    );
    expect(credentialSummary(null, null, texts)).toBeNull();
  });
});

describe('overview query', () => {
  it('builds the path with encoded values', () => {
    expect(overviewPath('c 1', { fieldKey: 'mod_q_x', status: 'expiring', withinDays: 30, page: 2 })).toBe(
      '/club-members/credentials?clubId=c%201&fieldKey=mod_q_x&status=expiring&withinDays=30&page=2&pageSize=25',
    );
    expect(overviewPath('c1', DEFAULT_OVERVIEW_QUERY)).toBe('/club-members/credentials?clubId=c1&withinDays=90&page=1&pageSize=25');
  });
  it('drops status=missing without a field and sanitises the page', () => {
    expect(normalizeOverviewQuery({ fieldKey: null, status: 'missing', withinDays: 90, page: 0 })).toEqual({ fieldKey: null, status: null, withinDays: 90, page: 1 });
    expect(overviewPath('c1', { fieldKey: 'k', status: 'missing', withinDays: 90, page: 1 })).toContain('status=missing');
    expect(overviewPath('c1', { fieldKey: '', status: 'missing', withinDays: 90, page: 1 })).not.toContain('status');
  });
  it('counts pages', () => {
    expect(overviewPageCount(0)).toBe(1);
    expect(overviewPageCount(26)).toBe(2);
  });
});

describe('enteredBy / limits / valueCount', () => {
  it('flags only self-entered credential or protected values as unverified', () => {
    expect(isUnverifiedSelfEntry({ type: 'credential', enteredBy: 'self' })).toBe(true);
    expect(isUnverifiedSelfEntry({ type: 'text', sensitive: true, enteredBy: 'self' })).toBe(true);
    expect(isUnverifiedSelfEntry({ type: 'credential', enteredBy: 'board' })).toBe(false);
    expect(isUnverifiedSelfEntry({ type: 'credential', enteredBy: null })).toBe(false);
    expect(isUnverifiedSelfEntry({ type: 'text', enteredBy: 'self' })).toBe(false);
  });

  it('clamps page to 1000 and pageSize to 100', () => {
    expect(normalizeOverviewQuery({ fieldKey: null, status: null, withinDays: 90, page: 5000 }).page).toBe(1000);
    expect(overviewPath('c1', DEFAULT_OVERVIEW_QUERY, 500)).toContain('pageSize=100');
  });

  it('never renders a null valueCount as 0', () => {
    expect(formatValueCount(null)).toBe('—');
    expect(formatValueCount(undefined)).toBe('—');
    expect(formatValueCount(0)).toBe('0');
    expect(formatValueCount(7)).toBe('7');
  });
});
