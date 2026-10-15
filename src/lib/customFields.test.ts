jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import {
  customFieldErrorKey,
  displayValue,
  editableFields,
  isNoFieldsError,
  type MemberCustomField,
  partitionFields,
  readOnlyFields,
  toFormField,
  valuesPatch,
  valuesToAnswers,
} from './customFields';

const field = (extra: Partial<MemberCustomField> = {}): MemberCustomField => ({
  id: '1',
  key: 'trikot',
  label: 'Trikotgröße',
  type: 'select',
  options: [
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
  ],
  visibleTo: 'vorstand',
  editableBy: 'self',
  sensitive: false,
  sortOrder: 0,
  archived: false,
  archivedAt: null,
  editable: true,
  value: null,
  updatedAt: null,
  ...extra,
});

describe('errors', () => {
  const err = (status: number, details?: unknown, message = 'm') => new ApiError(status, 'X', message, details);

  it('distinguishes the missing permissions', () => {
    expect(customFieldErrorKey(err(403, undefined, 'Missing members:read_sensitive permission'))).toBe('forms.cf.err.needsSensitive');
    expect(customFieldErrorKey(err(403, undefined, 'Missing permission to change one of these custom fields'))).toBe('forms.cf.err.cannotEdit');
    expect(customFieldErrorKey(err(403, undefined, 'One of these custom fields can only be changed by the board'))).toBe('forms.cf.err.cannotEdit');
    expect(customFieldErrorKey(err(403))).toBe('forms.cf.err.forbidden');
  });

  it('falls back to validation, not-found and the shared texts', () => {
    expect(customFieldErrorKey(err(422, { fields: { trikot: 'unknown_field' } }))).toBe('forms.err.fieldsInvalid');
    expect(customFieldErrorKey(err(422, { issues: [] }))).toBe('forms.cf.err.invalid');
    expect(customFieldErrorKey(err(404))).toBe('forms.cf.err.notFound');
    expect(customFieldErrorKey(err(429))).toBe('api.error.rate-limit');
    expect(customFieldErrorKey(new Error('offline'))).toBe('alert.general-error-description');
  });

  it('treats 403 and 404 of the load as "no fields", nothing else', () => {
    expect(isNoFieldsError(err(403))).toBe(true);
    expect(isNoFieldsError(err(404))).toBe(true);
    expect(isNoFieldsError(err(500))).toBe(false);
    expect(isNoFieldsError(new Error('x'))).toBe(false);
  });
});

describe('values of a member', () => {
  const fields: MemberCustomField[] = [
    field({ key: 'trikot', value: 'm' }),
    field({ key: 'notiz_text', type: 'text', options: null, label: 'Notiz', value: 'Hallo', editable: false, editableBy: 'vorstand' }),
    field({ key: 'haken', type: 'checkbox', options: null, label: 'Haken', value: true }),
    field({ key: 'leer', type: 'text', options: null, label: 'Leer', value: null }),
  ];

  it('splits editable and read-only fields', () => {
    expect(editableFields(fields).map((f) => f.key)).toEqual(['trikot', 'haken', 'leer']);
    expect(readOnlyFields(fields).map((f) => f.key)).toEqual(['notiz_text']);
    expect(editableFields([field({ editable: true, archived: true })])).toEqual([]);
  });

  it('shows everything read-only in a read-only view, whatever the server says about editing', () => {
    expect(partitionFields(fields, true)).toEqual({ editable: [], readOnly: fields });
    const normal = partitionFields(fields, false);
    expect(normal.editable.map((f) => f.key)).toEqual(['trikot', 'haken', 'leer']);
    expect(normal.readOnly.map((f) => f.key)).toEqual(['notiz_text']);
  });

  it('builds the answers and form fields for the shared renderer', () => {
    expect(valuesToAnswers(fields)).toEqual({ trikot: 'm', notiz_text: 'Hallo', haken: true });
    expect(toFormField(fields[0]!)).toEqual({
      key: 'trikot',
      type: 'select',
      label: 'Trikotgröße',
      options: [
        { value: 'm', label: 'M' },
        { value: 'l', label: 'L' },
      ],
    });
    expect(toFormField(fields[1]!)).toEqual({ key: 'notiz_text', type: 'text', label: 'Notiz' });
  });

  it('sends only changed editable values; cleared values are null; read-only values never', () => {
    const saved = valuesToAnswers(fields);
    expect(valuesPatch(fields, saved, saved)).toBeNull();
    expect(valuesPatch(fields, saved, { ...saved, trikot: 'l' })).toEqual({ trikot: 'l' });
    expect(valuesPatch(fields, saved, { ...saved, haken: false })).toEqual({ haken: null });
    expect(valuesPatch(fields, saved, { ...saved, leer: '  ' })).toBeNull();
    expect(valuesPatch(fields, saved, { ...saved, leer: 'x', notiz_text: 'manipuliert' })).toEqual({ leer: 'x' });
    const { trikot, ...withoutTrikot } = saved;
    void trikot;
    expect(valuesPatch(fields, saved, withoutTrikot)).toEqual({ trikot: null });
  });

  it('renders stored values with option labels, yes/no and the date helper', () => {
    const texts = { yes: 'ja', no: 'nein', formatDate: (v: string) => `<${v}>` };
    expect(displayValue(fields[0]!, texts)).toBe('M');
    expect(displayValue({ ...fields[0]!, type: 'multiselect', value: ['m', 'l', 'zzz'] }, texts)).toBe('M, L, zzz');
    expect(displayValue(fields[2]!, texts)).toBe('ja');
    expect(displayValue({ ...fields[2]!, value: false }, texts)).toBe('nein');
    expect(displayValue({ ...fields[2]!, value: null }, texts)).toBeNull();
    expect(displayValue({ ...fields[0]!, type: 'date', value: '2026-05-01' }, texts)).toBe('<2026-05-01>');
    expect(displayValue({ ...fields[0]!, type: 'number', value: 3 }, texts)).toBe('3');
    expect(displayValue(fields[3]!, texts)).toBeNull();
    expect(displayValue({ ...fields[3]!, value: '' }, texts)).toBeNull();
  });
});
