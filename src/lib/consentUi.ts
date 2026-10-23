import type { ConsentView } from '@/hooks/useConsents';

/** Label key of the state badge. An outdated decision is shown as "Text geändert" so it is not mistaken for current. */
export function consentBadgeKey(c: Pick<ConsentView, 'state' | 'open' | 'outdated'>): string {
  if (c.outdated) return 'consent.state.outdated';
  if (c.state === 'granted') return 'consent.state.granted';
  if (c.state === 'revoked') return 'consent.state.revoked';
  return c.open ? 'consent.state.open' : 'consent.state.none';
}

/** Which actions the sheet offers for a consent. Voluntary: "no" is always as easy as "yes". */
export function consentActions(c: Pick<ConsentView, 'state' | 'outdated'>): { grant: 'consent.action.grant' | 'consent.action.regrant' | null; decline: 'consent.action.decline' | 'consent.action.revoke' | null } {
  return {
    grant: c.state === 'granted' && !c.outdated ? null : c.state === 'granted' ? 'consent.action.regrant' : 'consent.action.grant',
    decline: c.state === 'revoked' ? null : c.state === 'granted' ? 'consent.action.revoke' : 'consent.action.decline',
  };
}
