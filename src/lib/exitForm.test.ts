jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import { exitDialogTouched, exitRequestBody, repinExit } from './exitForm';
import type { FormDefinition, FormField } from './formSchema';

const field = (key: string, extra: Partial<FormField> = {}): FormField => ({ key, type: 'text', label: key, ...extra });
const definition = (fields: FormField[], formVersionId = 'v1'): FormDefinition => ({
  formId: 'f',
  formVersionId,
  version: 1,
  purpose: 'austritt',
  name: 'Austritt',
  privacyNotice: null,
  childApplication: false,
  fields,
});

describe('exit request body', () => {
  it('sends the date, the pinned version and only visible, non-empty answers', () => {
    const def = definition([
      field('reason'),
      { key: 'confirm', type: 'checkbox', label: 'ok', required: true },
      field('other', { visibleIf: { fieldKey: 'confirm', op: 'checked' } }),
    ]);
    expect(exitRequestBody('2026-12-31', def, { reason: 'Umzug', confirm: false, other: 'x' })).toEqual({
      desiredEffectiveOn: '2026-12-31',
      answers: { reason: 'Umzug' },
      formVersionId: 'v1',
    });
    expect(exitRequestBody(null, def, { confirm: true, other: 'x', ghost: 'y' })).toEqual({
      answers: { confirm: true, other: 'x' },
      formVersionId: 'v1',
    });
  });

  it('never sends a separate reason', () => {
    expect(exitRequestBody('', definition([field('reason')]), { reason: 'a' })).not.toHaveProperty('reason');
  });
});

describe('re-pinning to a newer exit form', () => {
  const outdated = (current: unknown) => new ApiError(409, 'FORM_VERSION_OUTDATED', 'The form was changed in the meantime', { currentVersion: current });

  it('carries answers by key and names the lost ones with their old label', () => {
    const old = definition([field('reason', { label: 'Grund' }), field('note', { label: 'Notiz' })]);
    const next = definition([field('reason'), field('new_q')], 'v2');
    const result = repinExit(outdated(next), old, { reason: 'Umzug', note: 'tschüss', ghost: 'x' });
    expect(result?.definition.formVersionId).toBe('v2');
    expect(result?.answers).toEqual({ reason: 'Umzug' });
    expect(result?.dropped).toEqual(['Notiz', 'ghost']);
  });

  it('returns null when there is no new form or the error is something else', () => {
    const old = definition([field('reason')]);
    expect(repinExit(outdated(null), old, {})).toBeNull();
    expect(repinExit(new ApiError(409, 'CONFLICT', 'x', { code: 'exit_request_pending' }), old, {})).toBeNull();
    expect(repinExit(new Error('x'), old, {})).toBeNull();
  });
});

describe('closing the sheet', () => {
  it('counts a date or any non-empty answer as typed input', () => {
    expect(exitDialogTouched(null, {})).toBe(false);
    expect(exitDialogTouched('', { reason: '  ', confirm: false, list: [] })).toBe(false);
    expect(exitDialogTouched('2026-12-31', {})).toBe(true);
    expect(exitDialogTouched(null, { reason: 'x' })).toBe(true);
    expect(exitDialogTouched(null, { confirm: true })).toBe(true);
  });
});
