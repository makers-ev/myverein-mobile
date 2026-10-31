import { ApiError } from './api';
import { changedNameKeys, nameDraftFromMember, nameFieldErrorsFromApi, namePatch, validateName } from './memberName';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

const server = { firstName: 'Max', lastName: 'Muster', displayName: 'Max Muster' };

describe('nameDraftFromMember', () => {
  it('reads the new fields', () => {
    expect(nameDraftFromMember({ firstName: 'A', lastName: 'B', displayName: 'AB', name: 'x' })).toEqual({ firstName: 'A', lastName: 'B', displayName: 'AB' });
  });
  it('treats an older backend (fields absent) as empty and falls back to name', () => {
    expect(nameDraftFromMember({ name: 'Max Muster' })).toEqual({ firstName: '', lastName: '', displayName: 'Max Muster' });
    expect(nameDraftFromMember({ firstName: null, lastName: null, name: null })).toEqual({ firstName: '', lastName: '', displayName: '' });
    expect(nameDraftFromMember(null)).toEqual({ firstName: '', lastName: '', displayName: '' });
  });
});

describe('namePatch', () => {
  it('is empty without changes (whitespace ignored)', () => {
    expect(namePatch({ firstName: ' Max ', lastName: 'Muster', displayName: 'Max Muster ' }, server)).toEqual({});
    expect(changedNameKeys(server, server)).toEqual([]);
  });
  it('sends only changed fields, trimmed', () => {
    expect(namePatch({ ...server, firstName: '  Moritz ' }, server)).toEqual({ firstName: 'Moritz' });
    expect(namePatch({ ...server, displayName: 'Mo' }, server)).toEqual({ displayName: 'Mo' });
  });
  it('sends null for a cleared first/last name', () => {
    expect(namePatch({ ...server, firstName: '  ', lastName: '' }, server)).toEqual({ firstName: null, lastName: null });
  });
  it('sends a name on an older backend where the server value was empty', () => {
    expect(namePatch({ firstName: 'Max', lastName: '', displayName: 'Max Muster' }, { firstName: '', lastName: '', displayName: 'Max Muster' })).toEqual({ firstName: 'Max' });
  });
});

describe('validateName', () => {
  it('accepts valid names and an empty first/last name', () => {
    expect(validateName({ firstName: '', lastName: '', displayName: 'X' })).toEqual({});
  });
  it('requires a display name', () => {
    expect(validateName({ ...server, displayName: '  ' })).toEqual({ displayName: 'required' });
  });
  it('enforces the limits', () => {
    expect(validateName({ firstName: 'a'.repeat(101), lastName: 'b'.repeat(100), displayName: 'c'.repeat(201) })).toEqual({ firstName: 'too-long', displayName: 'too-long' });
    expect(validateName({ firstName: 'a'.repeat(100), lastName: '', displayName: 'c'.repeat(200) })).toEqual({});
  });
});

describe('nameFieldErrorsFromApi', () => {
  it('maps 422 details.fields per key and ignores unknown keys', () => {
    const err = new ApiError(422, 'VALIDATION_ERROR', 'x', { fields: { lastName: ['bad'], phone: 'bad' } });
    expect(nameFieldErrorsFromApi(err)).toEqual({ lastName: 'invalid' });
  });
  it('ignores other errors', () => {
    expect(nameFieldErrorsFromApi(new ApiError(422, 'X', 'x'))).toEqual({});
    expect(nameFieldErrorsFromApi(new ApiError(500, 'X', 'x', { fields: { firstName: 'a' } }))).toEqual({});
    expect(nameFieldErrorsFromApi(new Error('x'))).toEqual({});
  });
});
