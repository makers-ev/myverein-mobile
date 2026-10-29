import type { RootStackParamList } from './AppNavigator';

/** The five bottom tabs (Wave 14 N1). Order is the order in the bar. */
export type TabKey = 'heute' | 'kalender' | 'mitteilungen' | 'verein' | 'mehr';

export const TAB_ORDER: readonly TabKey[] = ['heute', 'kalender', 'mitteilungen', 'verein', 'mehr'];

/**
 * Which tab a stack route belongs to, so a sub-screen (a vote, the application queue, Settings) keeps its parent tab
 * highlighted. Routes missing here (Login, legal pages, ...) highlight nothing.
 */
export const TAB_ROUTES: Record<TabKey, readonly (keyof RootStackParamList)[]> = {
  heute: ['Home', 'Dashboard', 'Heute', 'Suche'],
  kalender: ['Kalender'],
  mitteilungen: ['Mitteilungen'],
  verein: ['Verein', 'ClubApplications', 'ProfileModules', 'Abstimmungen', 'Versammlung', 'Archiv', 'Bestaetigungen', 'AusweisKontrolle', 'JoinClub', 'CreateClub'],
  mehr: ['Mehr', 'Standorte', 'MeineDokumente', 'Mitgliedsausweis', 'PrivacyCenter', 'Notifications', 'Settings'],
};

export function tabForRoute(route: string | undefined): TabKey | null {
  if (!route) return null;
  return TAB_ORDER.find((tab) => (TAB_ROUTES[tab] as readonly string[]).includes(route)) ?? null;
}

interface TabContext {
  isAuthenticated: boolean;
  /** Account has linked children. */
  hasWards: boolean;
  /** Linked children but no club of its own. */
  guardianOnly: boolean;
}

/**
 * Stack route a tab opens. "Heute" is the guest start page for guests, the ward view for guardian-only accounts and the
 * Heute overview (`Dashboard` route) for everyone else.
 */
export function tabTarget(tab: TabKey, ctx: TabContext): keyof RootStackParamList {
  switch (tab) {
    case 'heute':
      if (!ctx.isAuthenticated) return 'Home';
      return ctx.guardianOnly ? 'Heute' : 'Dashboard';
    case 'kalender':
      return 'Kalender';
    case 'mitteilungen':
      return 'Mitteilungen';
    case 'verein':
      return 'Verein';
    case 'mehr':
      return 'Mehr';
  }
}

/** Tabs shown: a guardian-only account has no club, so Kalender/Mitteilungen/Verein would only show empty states. */
export function visibleTabs(ctx: Pick<TabContext, 'guardianOnly'>): TabKey[] {
  return TAB_ORDER.filter((tab) => !(ctx.guardianOnly && (tab === 'kalender' || tab === 'mitteilungen' || tab === 'verein')));
}

/** Routes a guardian-only account (no club) cannot use: the hidden tabs' roots. */
const CLUB_ONLY_ROUTES: readonly (keyof RootStackParamList)[] = ['Kalender', 'Mitteilungen', 'Verein', 'Standorte', 'ClubApplications', 'ProfileModules', 'Abstimmungen', 'Versammlung', 'Archiv', 'Bestaetigungen', 'AusweisKontrolle'];

/** Where to go after sign-in: `returnTo` only when the account can reach it, otherwise the account's own Heute. */
export function resolveReturnTo(returnTo: keyof RootStackParamList | undefined, ctx: TabContext): keyof RootStackParamList {
  if (returnTo && !(ctx.guardianOnly && CLUB_ONLY_ROUTES.includes(returnTo)) && returnTo !== 'Login') return returnTo;
  return tabTarget('heute', { ...ctx, isAuthenticated: true });
}
