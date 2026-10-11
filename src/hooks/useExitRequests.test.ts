import { exitErrorCode, formatDay } from './useExitRequests';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));

describe('exitErrorCode', () => {
  it('reads details.code of an API error', () => {
    expect(exitErrorCode({ details: { code: 'owner_protected' } })).toBe('owner_protected');
  });
  it('returns null without a code', () => {
    expect(exitErrorCode(new Error('x'))).toBeNull();
    expect(exitErrorCode({ details: [] })).toBeNull();
    expect(exitErrorCode(null)).toBeNull();
  });
});

describe('formatDay', () => {
  it('shows a dash for missing dates', () => {
    expect(formatDay(null)).toBe('—');
  });
  it('does not shift the calendar day', () => {
    expect(new Date('2026-12-31T00:00').getDate()).toBe(31);
    expect(formatDay('2026-12-31T00:00:00.000Z')).toBe(new Date('2026-12-31T00:00').toLocaleDateString());
  });
});
