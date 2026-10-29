jest.mock('./AppNavigator', () => ({}));

import { resolveReturnTo, tabForRoute, tabTarget, visibleTabs, TAB_ORDER, TAB_ROUTES } from './tabs';

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
