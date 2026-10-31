import { ApiError } from './api';
import {
  allowedModes,
  applyPatch,
  carryAnswers,
  checkFieldFile,
  childWarningKey,
  diffAnswers,
  lostEntryLabels,
  mergeConcurrentEdits,
  droppedLabels,
  fieldErrorsFromError,
  type FormField,
  formatBytes,
  formErrorKey,
  outdatedFrom,
  type MySubmission,
  privacyNoticeIndex,
  progressPercent,
  applyConflictKind,
  selectApplicationState,
  validateAnswers,
  visibleAnswers,
  visibleFieldKeys,
  visibleFields,
} from './formSchema';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

const FIELDS: FormField[] = [
  { key: 'first_name', type: 'text', label: 'Vorname', required: true, validation: { maxLength: 10 } },
  { key: 'category', type: 'select', label: 'Kategorie', required: true, options: [{ value: 'aktiv', label: 'Aktiv' }, { value: 'jugend', label: 'Jugend' }] },
  { key: 'parent_note', type: 'text', label: 'Hinweis Eltern', required: true, visibleIf: { fieldKey: 'category', op: 'eq', value: 'jugend' } },
  { key: 'sports', type: 'multiselect', label: 'Sport', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  { key: 'sports_detail', type: 'text', label: 'Details', visibleIf: { fieldKey: 'sports', op: 'in', value: ['a'] } },
  { key: 'newsletter', type: 'checkbox', label: 'Newsletter' },
  { key: 'newsletter_mail', type: 'text', label: 'Mail', visibleIf: { fieldKey: 'newsletter', op: 'checked' }, validation: { pattern: 'email' } },
  { key: 'privacy', type: 'info', label: 'Datenschutz', infoKind: 'privacy_notice', text: '' },
  { key: 'agree', type: 'consent', label: 'Ich stimme zu', required: true },
  { key: 'age', type: 'number', label: 'Alter', validation: { min: 3, max: 99 } },
  { key: 'born', type: 'date', label: 'Geburtstag', validation: { minDate: '1900-01-01', maxDate: '2030-12-31' } },
  { key: 'photo', type: 'image', label: 'Foto', required: true },
];

describe('visibility', () => {
  it('shows a conditional field only when its condition holds', () => {
    expect(visibleFieldKeys(FIELDS, {}).has('parent_note')).toBe(false);
    expect(visibleFieldKeys(FIELDS, { category: 'jugend' }).has('parent_note')).toBe(true);
    expect(visibleFieldKeys(FIELDS, { category: 'aktiv' }).has('parent_note')).toBe(false);
  });

  it('supports in (single and multi value), checked and neq', () => {
    expect(visibleFieldKeys(FIELDS, { sports: ['b'] }).has('sports_detail')).toBe(false);
    expect(visibleFieldKeys(FIELDS, { sports: ['b', 'a'] }).has('sports_detail')).toBe(true);
    expect(visibleFieldKeys(FIELDS, { newsletter: false }).has('newsletter_mail')).toBe(false);
    expect(visibleFieldKeys(FIELDS, { newsletter: true }).has('newsletter_mail')).toBe(true);
    const neq: FormField[] = [
      { key: 'a_field', type: 'select', label: 'A', options: [{ value: 'x', label: 'X' }] },
      { key: 'b_field', type: 'text', label: 'B', visibleIf: { fieldKey: 'a_field', op: 'neq', value: 'x' } },
    ];
    expect(visibleFieldKeys(neq, {}).has('b_field')).toBe(true);
    expect(visibleFieldKeys(neq, { a_field: 'x' }).has('b_field')).toBe(false);
  });

  it('hides a field behind a hidden field', () => {
    const chain: FormField[] = [
      { key: 'a_field', type: 'checkbox', label: 'A' },
      { key: 'b_field', type: 'checkbox', label: 'B', visibleIf: { fieldKey: 'a_field', op: 'checked' } },
      { key: 'c_field', type: 'text', label: 'C', visibleIf: { fieldKey: 'b_field', op: 'checked' } },
    ];
    // b is hidden, so its stale `true` must not reveal c.
    expect(visibleFieldKeys(chain, { b_field: true }).has('c_field')).toBe(false);
    expect(visibleFieldKeys(chain, { a_field: true, b_field: true }).has('c_field')).toBe(true);
  });

  it('ignores prototype keys in answers', () => {
    const answers = JSON.parse('{"__proto__": {"category": "jugend"}}') as Record<string, unknown>;
    expect(visibleFieldKeys(FIELDS, answers).has('parent_note')).toBe(false);
  });

  it('keeps info blocks in the visible list', () => {
    expect(visibleFields(FIELDS, {}).some((f) => f.key === 'privacy')).toBe(true);
    expect(visibleFields(FIELDS, {}).some((f) => f.key === 'parent_note')).toBe(false);
  });
});

describe('privacyNoticeIndex', () => {
  it('is null without a notice or when an info block without text carries it', () => {
    expect(privacyNoticeIndex(FIELDS, null)).toBeNull();
    expect(privacyNoticeIndex(FIELDS, '  ')).toBeNull();
    expect(privacyNoticeIndex(FIELDS, 'Text')).toBeNull();
  });
  it('goes above the first consent, else to the end', () => {
    const noInfo = FIELDS.filter((f) => f.type !== 'info');
    expect(privacyNoticeIndex(noInfo, 'Text')).toBe(noInfo.findIndex((f) => f.type === 'consent'));
    const noConsent = noInfo.filter((f) => f.type !== 'consent');
    expect(privacyNoticeIndex(noConsent, 'Text')).toBe(noConsent.length);
  });
});

describe('validateAnswers (client mirror)', () => {
  const ok = { first_name: 'Anna', category: 'aktiv', agree: true };

  it('requires visible required fields on submit only', () => {
    expect(validateAnswers(FIELDS, {}, { mode: 'draft' })).toEqual({});
    const errors = validateAnswers(FIELDS, {}, { mode: 'submit' });
    expect(errors).toMatchObject({ first_name: 'required', category: 'required', agree: 'required', photo: 'required' });
    expect(errors.parent_note).toBeUndefined();
  });

  it('makes a hidden required field optional and a visible one required', () => {
    expect(validateAnswers(FIELDS, { ...ok, category: 'jugend' }, { mode: 'submit', uploadedFieldKeys: new Set(['photo']) })).toEqual({ parent_note: 'required' });
    expect(validateAnswers(FIELDS, ok, { mode: 'submit', uploadedFieldKeys: new Set(['photo']) })).toEqual({});
  });

  it('accepts an uploaded required file', () => {
    expect(validateAnswers(FIELDS, ok, { mode: 'submit', uploadedFieldKeys: new Set(['photo']) })).toEqual({});
  });

  it('requires a required consent to be true', () => {
    expect(validateAnswers(FIELDS, { ...ok, agree: false }, { mode: 'submit', uploadedFieldKeys: new Set(['photo']) })).toEqual({ agree: 'required' });
  });

  it('checks lengths, presets, ranges, dates and options', () => {
    const e = (answers: Record<string, unknown>) => validateAnswers(FIELDS, answers, { mode: 'draft' });
    expect(e({ first_name: 'x'.repeat(11) })).toEqual({ first_name: 'too_long' });
    expect(e({ newsletter: true, newsletter_mail: 'nope' })).toEqual({ newsletter_mail: 'invalid_format' });
    expect(e({ newsletter: true, newsletter_mail: 'a@b.de' })).toEqual({});
    expect(e({ age: 2 })).toEqual({ age: 'too_small' });
    expect(e({ age: 100 })).toEqual({ age: 'too_large' });
    expect(e({ age: '5' })).toEqual({ age: 'invalid_type' });
    expect(e({ born: '1899-12-31' })).toEqual({ born: 'too_small' });
    expect(e({ born: '2031-01-01' })).toEqual({ born: 'too_large' });
    expect(e({ born: '2020-02-30' })).toEqual({ born: 'invalid_value' });
    expect(e({ category: 'other' })).toEqual({ category: 'not_an_option' });
    expect(e({ sports: ['a', 'z'] })).toEqual({ sports: 'not_an_option' });
    expect(e({ sports: ['a', 'a'] })).toEqual({ sports: 'invalid_value' });
  });

  it('mirrors the server character policy for typed text', () => {
    const e = (answers: Record<string, unknown>) => validateAnswers(FIELDS, answers, { mode: 'draft' });
    expect(e({ first_name: 'A\u0000B' })).toEqual({ first_name: 'invalid_value' });
    expect(e({ first_name: 'A\u202Eb' })).toEqual({ first_name: 'invalid_value' });
    expect(e({ first_name: 'A\u2028b' })).toEqual({ first_name: 'invalid_value' });
    expect(e({ first_name: 'A\uD800b' })).toEqual({ first_name: 'invalid_value' });
    expect(e({ first_name: 'A\nb' })).toEqual({ first_name: 'invalid_value' });
    expect(e({ first_name: '<b>Ä😀</b>' })).toEqual({});
    const area: FormField[] = [{ key: 'note_field', type: 'textarea', label: 'N' }];
    expect(validateAnswers(area, { note_field: 'a\nb\tc' }, { mode: 'draft' })).toEqual({});
    expect(validateAnswers(area, { note_field: 'a\u0007' }, { mode: 'draft' })).toEqual({ note_field: 'invalid_value' });
  });

  it('evaluates conditions on trimmed text like the server', () => {
    const f: FormField[] = [
      { key: 'a_field', type: 'text', label: 'A' },
      { key: 'b_field', type: 'text', label: 'B', visibleIf: { fieldKey: 'a_field', op: 'eq', value: 'ja' } },
    ];
    expect(visibleFieldKeys(f, { a_field: ' ja ' }).has('b_field')).toBe(true);
  });

  it('does not validate hidden fields', () => {
    expect(validateAnswers(FIELDS, { newsletter: false, newsletter_mail: 'nope' }, { mode: 'draft' })).toEqual({});
  });
});

describe('visibleAnswers', () => {
  it('drops hidden and empty answers', () => {
    expect(visibleAnswers(FIELDS, { first_name: 'A', parent_note: 'x', age: 5, newsletter: false, sports: [] })).toEqual({ first_name: 'A', age: 5 });
  });
});

describe('diffAnswers / applyPatch', () => {
  it('sends only changed keys and null for emptied ones', () => {
    const saved = { a_field: 'x', b_field: 'y', c_field: true };
    const current = { a_field: 'x', b_field: 'z', c_field: false, d_field: [] as string[], e_field: 'n' };
    expect(diffAnswers(saved, current)).toEqual({ b_field: 'z', c_field: null, e_field: 'n' });
  });
  it('treats empty strings, false and empty lists as not answered', () => {
    expect(diffAnswers({}, { a_field: '  ', b_field: false, c_field: [] })).toEqual({});
    expect(diffAnswers({ a_field: 'x' }, { a_field: '' })).toEqual({ a_field: null });
  });
  it('does not resend an untouched answer that the server stored trimmed', () => {
    expect(diffAnswers({ a_field: 'abc' }, { a_field: 'abc ' })).toEqual({});
    expect(diffAnswers({ a_field: 'abc' }, { a_field: 'abcd ' })).toEqual({ a_field: 'abcd ' });
  });
  it('skips refused keys', () => {
    expect(diffAnswers({}, { a_field: 'x', b_field: 'y' }, new Set(['a_field']))).toEqual({ b_field: 'y' });
  });
  it('compares lists by content', () => {
    expect(diffAnswers({ s: ['a', 'b'] }, { s: ['a', 'b'] })).toEqual({});
    expect(diffAnswers({ s: ['a', 'b'] }, { s: ['b'] })).toEqual({ s: ['b'] });
  });
  it('applyPatch mirrors the server merge (null removes)', () => {
    expect(applyPatch({ a_field: 'x', b_field: 'y' }, { a_field: null, c_field: 1 })).toEqual({ b_field: 'y', c_field: 1 });
  });
  it('a patch applied to the baseline reproduces the current answers', () => {
    const saved = { a_field: 'x', b_field: 'y' };
    const current = { a_field: 'q', c_field: true };
    expect(applyPatch(saved, diffAnswers(saved, current))).toEqual(current);
  });
});

describe('carryAnswers / droppedLabels', () => {
  const next: FormField[] = [
    { key: 'first_name', type: 'text', label: 'Vorname' },
    { key: 'photo', type: 'image', label: 'Foto' },
    { key: 'info_block', type: 'info', label: 'Info' },
  ];
  it('keeps answers of answerable fields and reports the rest', () => {
    const r = carryAnswers(next, { first_name: 'A', category: 'aktiv', photo: 'x', empty_field: '' }, []);
    expect(r.answers).toEqual({ first_name: 'A' });
    expect(r.dropped.sort()).toEqual(['category', 'photo']);
  });
  it('drops keys the server dropped as well', () => {
    expect(carryAnswers(next, { first_name: 'A' }, ['first_name'])).toEqual({ answers: {}, dropped: ['first_name'] });
  });
  it('labels dropped keys from the old definition', () => {
    expect(droppedLabels(FIELDS, ['category', 'gone', 'category'])).toEqual(['Kategorie', 'gone']);
  });
});

describe('re-pin helpers', () => {
  const next: FormField[] = [
    { key: 'first_name', type: 'text', label: 'Vorname' },
    { key: 'city_field', type: 'text', label: 'Ort' },
  ];
  it('keeps what was typed while the re-pin request was running', () => {
    const snapshot = { first_name: 'Anna' };
    const latest = { first_name: 'Anna', city_field: 'Bonn' };
    // the server answer lacks the new city; the typed value is merged in
    expect(mergeConcurrentEdits(snapshot, latest, { first_name: 'Anna' }, next)).toEqual({ first_name: 'Anna', city_field: 'Bonn' });
    // a value emptied meanwhile stays removed
    expect(mergeConcurrentEdits({ first_name: 'Anna' }, { first_name: '' }, { first_name: 'Anna' }, next)).toEqual({});
    // untouched keys keep the computed base; fields that no longer exist are not revived
    expect(mergeConcurrentEdits({ first_name: 'A' }, { first_name: 'A', gone_field: 'x' }, { first_name: 'B' }, next)).toEqual({ first_name: 'B' });
  });

  it('lists lost answers and files but not answers that were sent again', () => {
    const file = (id: string, fieldKey: string) => ({ id, fieldKey, filename: 'f', mimeType: 'image/png', sizeBytes: 1, kind: 'image', url: null });
    const labels = lostEntryLabels({
      oldFields: FIELDS,
      droppedKeys: ['first_name', 'category', 'parent_note'],
      finalAnswers: { first_name: 'Anna' },
      oldFiles: [file('1', 'photo'), file('2', 'photo')],
      newFiles: [file('2', 'photo')],
    });
    expect(labels).toEqual(['Kategorie', 'Hinweis Eltern', 'Foto']);
  });
});

describe('error mapping', () => {
  it('reads field errors of a 422', () => {
    const err = new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Answers do not match the form', { fields: { first_name: 'too_long', other: 'weird' } });
    expect(fieldErrorsFromError(err)).toEqual({ first_name: 'too_long', other: 'invalid_value' });
    expect(fieldErrorsFromError(new ApiError(422, 'X', 'm', { fields: {} }))).toBeNull();
    expect(fieldErrorsFromError(new ApiError(409, 'X', 'm', { fields: { a: 'required' } }))).toBeNull();
    expect(fieldErrorsFromError(new Error('x'))).toBeNull();
  });

  it('extracts FORM_VERSION_OUTDATED with the new definition', () => {
    const current = { formId: 'f', formVersionId: 'v2', version: 2, purpose: 'aufnahme', name: 'n', privacyNotice: null, childApplication: false, fields: [] };
    const info = outdatedFrom(new ApiError(409, 'FORM_VERSION_OUTDATED', 'm', { submissionId: 's1', currentVersion: current }));
    expect(info).toEqual({ current, submissionId: 's1' });
    // the club has no form any more
    expect(outdatedFrom(new ApiError(409, 'FORM_VERSION_OUTDATED', 'm', { currentVersion: null }))).toEqual({ current: null, submissionId: null });
    expect(outdatedFrom(new ApiError(409, 'CONFLICT', 'm'))).toBeNull();
    expect(outdatedFrom(new ApiError(422, 'FORM_VERSION_OUTDATED', 'm'))).toBeNull();
  });

  it('maps every documented code to its own text', () => {
    const key = (status: number, code: string, details?: unknown, message = 'm') => formErrorKey(new ApiError(status, code, message, details));
    expect(key(409, 'FORM_VERSION_OUTDATED')).toBe('forms.err.outdated');
    expect(key(409, 'CONFLICT', { code: 'draft_limit' })).toBe('forms.err.draftLimit');
    expect(key(409, 'CONFLICT', { code: 'draft_limit_user' })).toBe('forms.err.draftLimitUser');
    expect(key(422, 'QUOTA_EXCEEDED', { code: 'draft_upload_cap' })).toBe('forms.err.draftUploadCap');
    expect(key(422, 'QUOTA_EXCEEDED', { code: 'club_quota' })).toBe('forms.err.clubQuota');
    expect(key(422, 'QUOTA_EXCEEDED', { code: 'unattached_cap' })).toBe('forms.err.unattachedCap');
    expect(key(409, 'CONFLICT', { code: 'child_application_limit' })).toBe('forms.err.childLimit');
    expect(key(409, 'CONFLICT', { code: 'club_child_application_limit' })).toBe('forms.err.clubChildLimit');
    expect(key(409, 'CONFLICT', { code: 'child_application_unsupported' })).toBe('forms.err.childUnsupported');
    expect(key(403, 'FORBIDDEN', { code: 'email_not_verified' })).toBe('forms.err.emailNotVerified');
    expect(key(409, 'CONFLICT', { code: 'guardian_not_active' })).toBe('forms.err.guardianNotActive');
    expect(key(409, 'CONFLICT', { code: 'form_required' })).toBe('forms.err.formRequired');
    expect(key(409, 'CONFLICT', { code: 'submission_not_editable' })).toBe('forms.err.notEditable');
    expect(key(409, 'CONFLICT', { code: 'submission_not_withdrawable' })).toBe('forms.err.notWithdrawable');
    expect(key(409, 'CONFLICT', { code: 'application_withdrawn' })).toBe('forms.err.applicationWithdrawn');
    expect(key(409, 'CONFLICT', { code: 'member_rejoin_blocked' })).toBe('forms.err.rejoinBlocked');
    expect(key(409, 'ALREADY_MEMBER')).toBe('api.error.already-member');
    expect(key(409, 'APPLICATION_PENDING')).toBe('forms.err.applicationPending');
    expect(key(422, 'UNPROCESSABLE_ENTITY', { fields: { a: 'required' } })).toBe('forms.err.fieldsInvalid');
    expect(key(413, 'X')).toBe('forms.err.fileSize');
    expect(key(422, 'X', undefined, 'File exceeds maximum size of 10485760 bytes')).toBe('forms.err.fileSize');
    expect(key(422, 'X', undefined, 'Unsupported file type')).toBe('forms.err.fileType');
    expect(key(422, 'X', undefined, 'At most 5 files per submission')).toBe('forms.err.fileCount');
    expect(key(429, 'TOO_MANY_REQUESTS')).toBe('api.error.rate-limit');
    expect(key(500, 'INTERNAL')).toBe('api.error.server');
    expect(formErrorKey(new Error('boom'))).toBe('alert.general-error-description');
  });

  it('maps child warnings and refuses unknown ones', () => {
    expect(childWarningKey('child_is_adult')).toBe('forms.warn.child_is_adult');
    expect(childWarningKey('something_else')).toBeNull();
    expect(childWarningKey(null)).toBeNull();
  });
});

describe('file helpers', () => {
  it('accepts photos only: JPEG/PNG for file fields, plus WebP for photo fields, up to 10 MB', () => {
    const file = { type: 'file' } as const;
    const image = { type: 'image' } as const;
    expect(checkFieldFile(file, { type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(checkFieldFile(file, { type: 'image/png', size: 10 * 1024 * 1024 })).toBeNull();
    // PDF needs the website (no document picker, plan open point O5)
    expect(checkFieldFile(file, { type: 'application/pdf', size: 1000 })).toBe('file_type');
    expect(checkFieldFile(file, { type: 'image/webp', size: 1000 })).toBe('file_type');
    expect(checkFieldFile(image, { type: 'image/webp', size: 1000 })).toBeNull();
    expect(checkFieldFile(image, { type: 'image/gif', size: 1000 })).toBe('file_type');
    expect(checkFieldFile(file, { type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toBe('file_size');
    expect(checkFieldFile(file, { type: 'image/png', size: 0 })).toBe('file_size');
    // an unknown size (picker did not report it) is left to the server
    expect(checkFieldFile(file, { type: 'image/png', size: null })).toBeNull();
  });
  it('computes upload progress', () => {
    expect(progressPercent(50, 200)).toBe(25);
    expect(progressPercent(300, 200)).toBe(100);
    expect(progressPercent(5, 0)).toBeNull();
    expect(progressPercent(5, Number.NaN)).toBeNull();
  });
  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048, 'en')).toBe('2 KB');
    expect(formatBytes(1536 * 1024, 'en')).toBe('1.5 MB');
  });
});

describe('application state', () => {
  const base = { formVersionId: 'v', answers: {}, files: [], submittedAt: null, decidedAt: null, decisionNote: null, purpose: 'aufnahme', version: 1, club: { id: 'c', name: 'C', slug: 'demo' } };
  const sub = (over: Partial<MySubmission>): MySubmission => ({ id: 'x', onBehalfOf: 'self', status: 'draft', createdAt: '2026-10-01T10:00:00Z', ...base, ...over }) as MySubmission;

  it('picks the newest draft per mode and the submitted ones of this club only', () => {
    const mine = [
      sub({ id: 'old', createdAt: '2026-10-01T10:00:00Z' }),
      sub({ id: 'new', createdAt: '2026-10-02T10:00:00Z' }),
      sub({ id: 'kid', onBehalfOf: 'guardian' }),
      sub({ id: 'other-club', club: { id: 'd', name: 'D', slug: 'other' } }),
      sub({ id: 'exit', purpose: 'austritt' }),
      sub({ id: 'sent', status: 'submitted' }),
      sub({ id: 'gone', status: 'withdrawn' }),
    ];
    const state = selectApplicationState(mine, 'demo');
    expect(state.drafts.self?.id).toBe('new');
    expect(state.drafts.guardian?.id).toBe('kid');
    expect(state.submitted.map((s) => s.id)).toEqual(['sent']);
  });

  it('blocks a second application for oneself and offers the child mode only if the form supports it', () => {
    expect(allowedModes({ childApplication: true }, [])).toEqual(['self', 'guardian']);
    expect(allowedModes({ childApplication: false }, [])).toEqual(['self']);
    expect(allowedModes({ childApplication: true }, [{ onBehalfOf: 'self' }])).toEqual(['guardian']);
    expect(allowedModes({ childApplication: false }, [{ onBehalfOf: 'self' }])).toEqual([]);
    expect(allowedModes({ childApplication: true }, [{ onBehalfOf: 'guardian' }])).toEqual(['self', 'guardian']);
  });
});

describe('applyConflictKind', () => {
  it('tells the known 409 codes apart', () => {
    expect(applyConflictKind(new ApiError(409, 'ALREADY_MEMBER', 'm'))).toBe('already_member');
    expect(applyConflictKind(new ApiError(409, 'APPLICATION_PENDING', 'm'))).toBe('application_pending');
    expect(applyConflictKind(new ApiError(409, 'CONFLICT', 'm'))).toBe('other');
    expect(applyConflictKind(new ApiError(422, 'ALREADY_MEMBER', 'm'))).toBeNull();
    expect(applyConflictKind(new Error('x'))).toBeNull();
  });
});
