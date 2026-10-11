import { ApiError } from './api';
import { isMinorBirthDate, photoFailureKey } from './memberPhoto';
import { initialsOf } from '@/components/verein/MemberAvatar';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

describe('isMinorBirthDate', () => {
  const today = new Date(2026, 9, 11); // 2026-10-11

  it('treats unknown or invalid dates as adult', () => {
    expect(isMinorBirthDate(null, today)).toBe(false);
    expect(isMinorBirthDate(undefined, today)).toBe(false);
    expect(isMinorBirthDate('garbage', today)).toBe(false);
  });

  it('is a minor until the 18th birthday', () => {
    expect(isMinorBirthDate('2008-10-12', today)).toBe(true);
    expect(isMinorBirthDate('2008-10-11', today)).toBe(false);
    expect(isMinorBirthDate('2015-01-01', today)).toBe(true);
    expect(isMinorBirthDate('1980-05-05', today)).toBe(false);
  });
});

describe('initialsOf', () => {
  it('uses first and last word', () => {
    expect(initialsOf('Anna Maria Müller')).toBe('AM');
    expect(initialsOf('  anna ')).toBe('A');
    expect(initialsOf(null)).toBe('?');
    expect(initialsOf('')).toBe('?');
  });
});

describe('photoFailureKey', () => {
  it('maps quota before the generic 422', () => {
    expect(photoFailureKey(new ApiError(422, 'QUOTA_EXCEEDED', 'x'), true)).toBe('api.error.quota');
    expect(photoFailureKey(new ApiError(422, 'VALIDATION_ERROR', 'x'), true)).toBe('member-photo.error.invalid');
  });
  it('explains 403 only for the own photo', () => {
    expect(photoFailureKey(new ApiError(403, 'FORBIDDEN', 'x'), true)).toBe('member-photo.error.minor');
    expect(photoFailureKey(new ApiError(403, 'FORBIDDEN', 'x'), false)).toBe('api.error.forbidden');
  });
});
