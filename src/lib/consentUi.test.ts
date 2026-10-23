import { consentActions, consentBadgeKey } from './consentUi';

describe('consentBadgeKey', () => {
  it('marks an outdated decision as changed text before anything else', () => {
    expect(consentBadgeKey({ state: 'granted', open: false, outdated: true })).toBe('consent.state.outdated');
  });
  it('distinguishes open (asked, undecided) from no decision', () => {
    expect(consentBadgeKey({ state: 'none', open: true, outdated: false })).toBe('consent.state.open');
    expect(consentBadgeKey({ state: 'none', open: false, outdated: false })).toBe('consent.state.none');
    expect(consentBadgeKey({ state: 'revoked', open: false, outdated: false })).toBe('consent.state.revoked');
  });
});

describe('consentActions', () => {
  it('offers yes and no for an undecided consent', () => {
    expect(consentActions({ state: 'none', outdated: false })).toEqual({ grant: 'consent.action.grant', decline: 'consent.action.decline' });
  });
  it('offers only revoke for a current grant and re-confirm for an outdated one', () => {
    expect(consentActions({ state: 'granted', outdated: false })).toEqual({ grant: null, decline: 'consent.action.revoke' });
    expect(consentActions({ state: 'granted', outdated: true })).toEqual({ grant: 'consent.action.regrant', decline: 'consent.action.revoke' });
  });
  it('offers only a new grant after a revoke', () => {
    expect(consentActions({ state: 'revoked', outdated: false })).toEqual({ grant: 'consent.action.grant', decline: null });
  });
});
