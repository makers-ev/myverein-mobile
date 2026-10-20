import { isSheetEventMissing, resolveSheetEvent } from './eventFocus';

const e = (id: string): { id: string; from?: string } => ({ id });

describe('resolveSheetEvent', () => {
  it('prefers the listed event, falls back to the fetched one for the same id only', () => {
    const listed = { id: 'a', from: 'list' };
    expect(resolveSheetEvent([listed], 'a', { id: 'a', from: 'fetched' })).toBe(listed);
    expect(resolveSheetEvent([], 'a', e('a'))).toEqual(e('a'));
    expect(resolveSheetEvent([], 'a', e('b'))).toBeNull();
    expect(resolveSheetEvent([], 'a', null)).toBeNull();
  });
});

describe('isSheetEventMissing', () => {
  it('is true only for an id that is unresolved after loading', () => {
    expect(isSheetEventMissing({ eventId: 'a', loading: false, resolved: null })).toBe(true);
    expect(isSheetEventMissing({ eventId: 'a', loading: true, resolved: null })).toBe(false);
    expect(isSheetEventMissing({ eventId: 'a', loading: false, resolved: e('a') })).toBe(false);
    expect(isSheetEventMissing({ eventId: null, loading: false, resolved: null })).toBe(false);
  });
});
