import { cancelBody, cancelPreviewKind, withNotify, withNotifyQuery, type CancelPreview } from './notifyOptions';

const preview = (over: Partial<CancelPreview['audience']> = {}, top: Partial<CancelPreview> = {}): CancelPreview => ({
  alreadyCancelled: false,
  confirmed: 2,
  waitlisted: 1,
  departmentCalendar: false,
  audience: { total: 3, reachable: 3, inApp: 3, email: 2, emailOnly: 0, unreachable: 0, sharedAddress: 0, tooLarge: false, ...over },
  ...top,
});

describe('notifyOptions', () => {
  it('sends notify only when it is switched off', () => {
    expect(withNotify({ a: 1 }, true)).toEqual({ a: 1 });
    expect(withNotify({ a: 1 }, false)).toEqual({ a: 1, notify: false });
  });

  it('appends ?notify=false or &notify=false', () => {
    expect(withNotifyQuery('/events/1?clubId=c', true)).toBe('/events/1?clubId=c');
    expect(withNotifyQuery('/events/1?clubId=c', false)).toBe('/events/1?clubId=c&notify=false');
    expect(withNotifyQuery('/events/1', false)).toBe('/events/1?notify=false');
  });

  it('builds the cancel body', () => {
    expect(cancelBody('  ', true)).toEqual({});
    expect(cancelBody(' Unwetter ', false)).toEqual({ reason: 'Unwetter', notify: false });
    expect(cancelBody('x'.repeat(600), true).reason).toHaveLength(500);
  });

  it('classifies the preview', () => {
    expect(cancelPreviewKind(preview())).toBe('some');
    expect(cancelPreviewKind(preview({ total: 0 }))).toBe('nobody');
    expect(cancelPreviewKind(preview({ tooLarge: true }))).toBe('too-large');
    expect(cancelPreviewKind(preview({}, { alreadyCancelled: true }))).toBe('already-cancelled');
  });
});
