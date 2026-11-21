jest.mock('./AppNavigator', () => ({}));

import { externalRoutes, resolveReturnTo, tabForRoute, tabTarget, visibleTabs, TAB_ORDER, TAB_ROUTES } from './tabs';

describe('tabs', () => {
  it('has exactly five tabs in the agreed order', () => {
    expect(TAB_ORDER).toEqual(['heute', 'kalender', 'mitteilungen', 'verein', 'mehr']);
  });

  it('keeps the parent tab for sub-screens and nothing for login/legal', () => {
    expect(tabForRoute('Abstimmungen')).toBe('verein');
    expect(tabForRoute('Settings')).toBe('mehr');
    expect(tabForRoute('Standorte')).toBe('mehr');
    expect(tabForRoute('Dashboard')).toBe('heute');
    expect(tabForRoute('Login')).toBeNull();
    expect(tabForRoute(undefined)).toBeNull();
  });

  it('assigns every route to at most one tab', () => {
    const all = TAB_ORDER.flatMap((t) => TAB_ROUTES[t] as readonly string[]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('opens guest start, ward view or overview for Heute', () => {
    expect(tabTarget('heute', { isAuthenticated: false, hasWards: false, guardianOnly: false })).toBe('Home');
    expect(tabTarget('heute', { isAuthenticated: true, hasWards: true, guardianOnly: true })).toBe('Heute');
    expect(tabTarget('heute', { isAuthenticated: true, hasWards: true, guardianOnly: false })).toBe('Dashboard');
  });

  it('hides club tabs for guardian-only accounts', () => {
    expect(visibleTabs({ guardianOnly: true })).toEqual(['heute', 'mehr']);
    expect(visibleTabs({ guardianOnly: false })).toHaveLength(5);
  });
});

describe('resolveReturnTo', () => {
  const member = { isAuthenticated: true, hasWards: false, guardianOnly: false };
  const guardian = { isAuthenticated: true, hasWards: true, guardianOnly: true };
  it('keeps a reachable returnTo and falls back to Heute', () => {
    expect(resolveReturnTo('Kalender', member)).toBe('Kalender');
    expect(resolveReturnTo(undefined, member)).toBe('Dashboard');
    expect(resolveReturnTo('Login', member)).toBe('Dashboard');
  });
  it('sends a guardian-only account away from club-only routes', () => {
    expect(resolveReturnTo('Kalender', guardian)).toBe('Heute');
    expect(resolveReturnTo('Settings', guardian)).toBe('Settings');
  });
});

describe('external roles (Wave 15)', () => {
  const sponsor = { isAuthenticated: true, hasWards: false, guardianOnly: false, externalRole: 'sponsor' as const };
  const provider = { ...sponsor, externalRole: 'dienstleister' as const };

  it('shows only Heute and Mehr, and Heute opens the role start screen', () => {
    expect(visibleTabs({ guardianOnly: false, externalRole: 'sponsor' })).toEqual(['heute', 'mehr']);
    expect(visibleTabs({ guardianOnly: false, externalRole: null })).toHaveLength(5);
    expect(tabTarget('heute', sponsor)).toBe('Partner');
    expect(tabTarget('heute', provider)).toBe('Einsatz');
    expect(tabTarget('heute', { ...sponsor, isAuthenticated: false })).toBe('Home');
  });

  it('keeps the new routes under their tabs', () => {
    expect(tabForRoute('Partner')).toBe('heute');
    expect(tabForRoute('Einsatz')).toBe('heute');
    expect(tabForRoute('Sponsoren')).toBe('verein');
  });

  it('allows only the role own screen and account/legal screens', () => {
    expect(externalRoutes('sponsor')).toContain('Partner');
    expect(externalRoutes('sponsor')).not.toContain('Einsatz');
    for (const role of ['sponsor', 'dienstleister'] as const) {
      for (const club of ['Dashboard', 'Kalender', 'Verein', 'Mitteilungen', 'Standorte', 'Sponsoren', 'JoinClub', 'Mitgliedsausweis'] as const) {
        expect(externalRoutes(role)).not.toContain(club);
      }
    }
  });

  it('returns to the own start screen after sign-in unless the route is allowed', () => {
    expect(resolveReturnTo('Kalender', sponsor)).toBe('Partner');
    expect(resolveReturnTo(undefined, provider)).toBe('Einsatz');
    expect(resolveReturnTo('Settings', sponsor)).toBe('Settings');
  });
});
