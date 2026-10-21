import { daysUntil, dpaHint, isOpenRequest, normalizeLevels, summarizeExport, type DpaCurrent } from './privacyCenter';

const dpa = (over: Partial<DpaCurrent['status']>, canAccept: boolean, version: DpaCurrent['version'] = { id: 'v', version: 1, title: 'AV' }): DpaCurrent => ({
  version,
  status: { required: true, accepted: false, deadline: null, daysLeft: 10, blocked: false, ...over },
  canAccept,
});

describe('normalizeLevels', () => {
  it('defaults everything unknown to nur_vorstand', () => {
    expect(normalizeLevels(undefined)).toEqual({ phone: 'nur_vorstand', email: 'nur_vorstand', address: 'nur_vorstand', photo: 'nur_vorstand' });
    expect(normalizeLevels({ phone: 'alle', email: 'trainer', photo: 'mitglieder' })).toEqual({ phone: 'nur_vorstand', email: 'trainer', address: 'nur_vorstand', photo: 'mitglieder' });
  });
});

describe('requests', () => {
  it('knows open requests', () => {
    expect(isOpenRequest({ status: 'open' })).toBe(true);
    expect(isOpenRequest({ status: 'in_progress' })).toBe(true);
    expect(isOpenRequest({ status: 'done' })).toBe(false);
  });
  it('counts days to the deadline', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(daysUntil('2026-10-11T12:00:00Z', now)).toBe(10);
    expect(daysUntil('2026-09-29T12:00:00Z', now)).toBe(-2);
    expect(daysUntil('garbage', now)).toBe(0);
  });
});

describe('summarizeExport', () => {
  it('keeps only counts, never the content', () => {
    const s = summarizeExport({ generatedAt: '2026-10-01T00:00:00Z', sections: { member: { name: 'x', email: 'y' }, events: [1, 2, 3], none: null }, files: [{}, {}] });
    expect(s).toEqual({ generatedAt: '2026-10-01T00:00:00Z', sections: [{ key: 'member', count: 2 }, { key: 'events', count: 3 }, { key: 'none', count: 0 }], files: 2 });
    expect(JSON.stringify(s)).not.toContain('"x"');
  });
  it('survives a malformed answer', () => {
    expect(summarizeExport(null)).toEqual({ generatedAt: null, sections: [], files: 0 });
  });
});

describe('dpaHint', () => {
  it('asks only the owner to confirm on the website', () => {
    expect(dpaHint(dpa({}, true))).toBe('owner-confirm');
    expect(dpaHint(dpa({}, false))).toBeNull();
    expect(dpaHint(dpa({ blocked: true }, false))).toBe('blocked');
  });
  it('is silent without a published version, when not required or already accepted', () => {
    expect(dpaHint(dpa({}, true, null))).toBeNull();
    expect(dpaHint(dpa({ required: false }, true))).toBeNull();
    expect(dpaHint(dpa({ accepted: true }, true))).toBeNull();
    expect(dpaHint(null)).toBeNull();
  });
});
