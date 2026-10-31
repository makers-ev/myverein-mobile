import { ackErrorKey, ackNeedsReload, canAnswerNow, splitAcknowledgements, type MyAcknowledgement } from './acknowledgements';

const base: MyAcknowledgement = {
  id: 'a', documentTitle: 'T', versionNo: 1, clubMemberId: 'm', personName: 'P', relation: 'self', status: 'offen', wording: 'w',
  requestedAt: '2026-10-01T00:00:00Z', dueAt: null, respondedAt: null, requiresReauth: false, canAnswer: true, isCurrentVersion: true,
};
const a = (over: Partial<MyAcknowledgement>): MyAcknowledgement => ({ ...base, ...over });

describe('splitAcknowledgements', () => {
  it('sorts open by deadline and done by newest answer', () => {
    const { open, done } = splitAcknowledgements([
      a({ id: 'late', dueAt: '2026-12-01' }),
      a({ id: 'none' }),
      a({ id: 'soon', dueAt: '2026-11-01' }),
      a({ id: 'old', status: 'bestaetigt', respondedAt: '2026-10-02T00:00:00Z' }),
      a({ id: 'new', status: 'abgelehnt', respondedAt: '2026-10-05T00:00:00Z' }),
      a({ id: 'exp', status: 'abgelaufen' }),
    ]);
    expect(open.map((x) => x.id)).toEqual(['soon', 'late', 'none']);
    expect(done.map((x) => x.id)).toEqual(['new', 'old', 'exp']);
  });
});

describe('answering and errors', () => {
  it('lets only open answerable requests be answered (minor with account is read-only)', () => {
    expect(canAnswerNow(a({}))).toBe(true);
    expect(canAnswerNow(a({ canAnswer: false }))).toBe(false);
    expect(canAnswerNow(a({ status: 'bestaetigt' }))).toBe(false);
  });

  it('maps backend detail codes', () => {
    expect(ackErrorKey({ details: { code: 'reauth_failed' } })).toBe('ack.error.reauth_failed');
    expect(ackErrorKey({ details: { code: 'other' } })).toBeNull();
    expect(ackErrorKey(new Error('x'))).toBeNull();
    expect(ackNeedsReload({ details: { code: 'expired' } })).toBe(true);
    expect(ackNeedsReload({ details: { code: 'reauth_failed' } })).toBe(false);
  });
});
