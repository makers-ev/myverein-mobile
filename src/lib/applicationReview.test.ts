import { ApiError } from './api';
import {
  answerText,
  approveBody,
  clampPage,
  duplicateKindKey,
  isStaleDecision,
  listQuery,
  type MappingEntry,
  mappingReasonKey,
  mappingTargetText,
  rejectBody,
  reviewErrorKey,
  reviewWarningKey,
  shortHash,
  isReviewFilePath,
  reviewFileView,
} from './applicationReview';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe('request helpers', () => {
  it('builds the paged list query', () => {
    expect(listQuery('c1', 2)).toBe('clubId=c1&page=2&pageSize=20');
    expect(listQuery('c 1', 0, 5)).toBe('clubId=c%201&page=1&pageSize=5');
  });
  it('clamps the page after decisions emptied the last one', () => {
    expect(clampPage(3, 41)).toBe(3);
    expect(clampPage(3, 40)).toBe(2);
    expect(clampPage(2, 0)).toBe(1);
    expect(clampPage(0, 10)).toBe(1);
  });
  it('sends a category only when the board chose one', () => {
    expect(approveBody('')).toBeUndefined();
    expect(approveBody('cat-1')).toEqual({ categoryId: 'cat-1' });
  });
  it('keeps the internal note and the applicant message apart and drops empty ones', () => {
    expect(rejectBody('  intern  ', ' Bitte melde dich ')).toEqual({ note: 'intern', applicantMessage: 'Bitte melde dich' });
    expect(rejectBody('', '  ')).toEqual({});
    expect(rejectBody('nur intern', '')).toEqual({ note: 'nur intern' });
  });
});

describe('display helpers', () => {
  it('formats answers', () => {
    expect(answerText({ answered: false, display: null }, t)).toBe('—');
    expect(answerText({ answered: true, display: true }, t)).toBe('forms.review.yes');
    expect(answerText({ answered: true, display: false }, t)).toBe('forms.review.no');
    expect(answerText({ answered: true, display: ['A', 'B'] }, t)).toBe('A, B');
    expect(answerText({ answered: true, display: 42 }, t)).toBe('42');
    // a redacted answer has no display
    expect(answerText({ answered: true, display: null }, t)).toBe('—');
  });

  it('translates mapping targets and frames custom fields', () => {
    const base: MappingEntry = { fieldKey: 'k', fieldLabel: 'L', kind: 'master', target: 'firstName', customFieldKey: null, targetLabel: 'Vorname', willApply: true };
    expect(mappingTargetText(base, t)).toBe('forms.review.target.firstName');
    const custom: MappingEntry = { ...base, kind: 'custom', target: null, customFieldKey: 'jersey', targetLabel: 'Zusatzfeld „Trikotgröße“' };
    expect(mappingTargetText(custom, t)).toBe('forms.review.target.custom:{"name":"Trikotgröße"}');
    expect(mappingTargetText({ ...custom, targetLabel: null }, t)).toBe('forms.review.target.custom:{"name":"jersey"}');
    expect(mappingTargetText({ ...base, kind: 'none', target: null }, t)).toBeNull();
    // an unknown allowlist target from a newer backend is not shown as a raw key
    expect(mappingTargetText({ ...base, target: 'shoeSize' }, t)).toBeNull();
  });

  it('maps skip reasons, duplicates, warnings and hashes', () => {
    expect(mappingReasonKey('not_answered')).toBe('forms.review.mapping.reason.not_answered');
    expect(mappingReasonKey('custom_field_archived')).toBe('forms.review.mapping.reason.custom_field_archived');
    expect(mappingReasonKey('brand_new')).toBe('forms.review.mapping.reason.other');
    expect(mappingReasonKey(undefined)).toBe('forms.review.mapping.reason.other');
    expect(duplicateKindKey(['name_birth_date'])).toBe('forms.review.duplicate.name');
    expect(duplicateKindKey(['email'])).toBe('forms.review.duplicate.email');
    expect(duplicateKindKey(['name_birth_date', 'email'])).toBe('forms.review.duplicate.both');
    expect(reviewWarningKey('child_is_adult')).toBe('forms.review.warn.child_is_adult');
    expect(reviewWarningKey('x')).toBeNull();
    expect(shortHash('0123456789abcdef0123')).toBe('0123456789ab');
  });
});

describe('decision errors', () => {
  it('recognises a stale list', () => {
    expect(isStaleDecision(new ApiError(404, 'NOT_FOUND', 'm'))).toBe(true);
    expect(isStaleDecision(new ApiError(409, 'CONFLICT', 'Application has already been decided'))).toBe(true);
    expect(isStaleDecision(new ApiError(409, 'CONFLICT', 'm', { code: 'application_withdrawn' }))).toBe(true);
    expect(isStaleDecision(new ApiError(409, 'CONFLICT', 'm', { code: 'decision_busy' }))).toBe(false);
    expect(isStaleDecision(new ApiError(409, 'CONFLICT', 'Applicant is already a member of this club'))).toBe(false);
    expect(isStaleDecision(new ApiError(500, 'X', 'm'))).toBe(false);
    expect(isStaleDecision(new Error('x'))).toBe(false);
  });
  it('maps decision errors to plain texts', () => {
    expect(reviewErrorKey(new ApiError(409, 'CONFLICT', 'Application has already been decided'))).toBe('forms.review.err.decided');
    expect(reviewErrorKey(new ApiError(409, 'CONFLICT', 'm', { code: 'application_withdrawn' }))).toBe('forms.err.applicationWithdrawn');
    expect(reviewErrorKey(new ApiError(409, 'CONFLICT', 'm', { code: 'decision_busy' }))).toBe('forms.err.decisionBusy');
    expect(reviewErrorKey(new ApiError(409, 'CONFLICT', 'Applicant is already a member of this club'))).toBe('forms.review.err.alreadyMember');
    expect(reviewErrorKey(new ApiError(404, 'NOT_FOUND', 'Application not found'))).toBe('forms.review.err.gone');
    expect(reviewErrorKey(new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Unknown or archived category'))).toBe('forms.review.err.category');
    expect(reviewErrorKey(new ApiError(403, 'FORBIDDEN', 'm'))).toBe('api.error.forbidden');
    expect(reviewErrorKey(new ApiError(409, 'CONFLICT', 'm', { code: 'member_rejoin_blocked' }))).toBe('forms.err.rejoinBlocked');
    expect(reviewErrorKey(new TypeError('network'))).toBe('alert.general-error-description');
  });
});

describe('review files', () => {
  const id = '0b9f3c1e-6d2a-4f6b-9c1d-2a7e5b8f4c10';
  it('only accepts the authenticated submission file path', () => {
    expect(isReviewFilePath(`/form-submissions/${id}/files/${id}`)).toBe(true);
    expect(isReviewFilePath(null)).toBe(false);
    expect(isReviewFilePath(`https://evil.test/form-submissions/${id}/files/${id}`)).toBe(false);
    expect(isReviewFilePath(`/form-submissions/${id}/files/${id}/../../x`)).toBe(false);
    expect(isReviewFilePath(`/media/${id}`)).toBe(false);
    expect(isReviewFilePath(`/form-submissions/${id}/files/${id}?x=1`)).toBe(false);
  });

  it('shows images in the app, leaves documents to the website and marks protected files', () => {
    const path = `/form-submissions/${id}/files/${id}`;
    expect(reviewFileView({ path, mimeType: 'image/jpeg', redacted: false })).toBe('image');
    expect(reviewFileView({ path, mimeType: 'application/pdf', redacted: false })).toBe('document');
    expect(reviewFileView({ path: null, mimeType: null, redacted: true })).toBe('protected');
    expect(reviewFileView({ path, mimeType: 'image/png', redacted: true })).toBe('protected');
    expect(reviewFileView({ path: '/x', mimeType: 'image/png', redacted: false })).toBe('protected');
  });
});
