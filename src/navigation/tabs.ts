import type { RootStackParamList } from './AppNavigator';
import type { ExternalRole } from '@/lib/outreach';

/** The five bottom tabs (Wave 14 N1). Order is the order in the bar. */
export type TabKey = 'heute' | 'kalender' | 'mitteilungen' | 'verein' | 'mehr';

export const TAB_ORDER: readonly TabKey[] = ['heute', 'kalender', 'mitteilungen', 'verein', 'mehr'];

/**
 * Which tab a stack route belongs to, so a sub-screen (a vote, the application queue, Settings) keeps its parent tab
 * highlighted. Routes missing here (Login, legal pages, ...) highlight nothing.
 */
export const TAB_ROUTES: Record<TabKey, readonly (keyof RootStackParamList)[]> = {
  heute: ['Home', 'Dashboard', 'Heute', 'Suche', 'Partner', 'Einsatz'],
  kalender: ['Kalender'],
  mitteilungen: ['Mitteilungen'],
  verein: ['Verein', 'ClubApplications', 'ProfileModules', 'Abstimmungen', 'Versammlung', 'Archiv', 'Bestaetigungen', 'AusweisKontrolle', 'JoinClub', 'CreateClub', 'Sponsoren'],
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
  /** Reduced login of the active club (Wave 15 M1): sponsor or service provider, see `useExternalAccess`. */
  externalRole?: ExternalRole | null;
  /** All reduced roles (an account may be sponsor and service provider). */
  externalRoles?: readonly ExternalRole[];
  /** Guest membership whose role is not known (loading/failed): fail closed to the reduced app. */
  externalPending?: boolean;
}

/** Stack route of the reduced start screen of an external role. */
export const EXTERNAL_HOME: Record<ExternalRole, keyof RootStackParamList> = { sponsor: 'Partner', dienstleister: 'Einsatz' };

/**
 * Stack route a tab opens. "Heute" is the guest start page for guests, the ward view for guardian-only accounts and the
 * Heute overview (`Dashboard` route) for everyone else.
 */
export function tabTarget(tab: TabKey, ctx: TabContext): keyof RootStackParamList {
  switch (tab) {
    case 'heute':
      if (!ctx.isAuthenticated) return 'Home';
      if (ctx.externalRole) return EXTERNAL_HOME[ctx.externalRole];
      if (ctx.externalPending) return 'Partner';
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

/**
 * Tabs shown: a guardian-only account has no club, so Kalender/Mitteilungen/Verein would only show empty states; an external
 * role (sponsor / service provider) gets the reduced app, only its own start screen and Mehr (Wave 15 M1).
 */
export function visibleTabs(ctx: Pick<TabContext, 'guardianOnly' | 'externalRole' | 'externalPending'>): TabKey[] {
  const reduced = ctx.guardianOnly || !!ctx.externalRole || !!ctx.externalPending;
  return TAB_ORDER.filter((tab) => !(reduced && (tab === 'kalender' || tab === 'mitteilungen' || tab === 'verein')));
}

/**
 * Everything the reduced app may open: the start screen of each held role (an account with both roles reaches Partner AND
 * Einsatz), Mehr and the account/legal screens, never club or member screens. With no known role (pending) only `Partner`,
 * which shows the loading/retry state.
 */
export function externalRoutes(roles: readonly ExternalRole[]): readonly (keyof RootStackParamList)[] {
  const homes = roles.length > 0 ? roles.map((r) => EXTERNAL_HOME[r]) : [EXTERNAL_HOME.sponsor];
  return [...homes, 'Mehr', 'Settings', 'Notifications', 'PrivacyPolicy', 'Imprint', 'TermsOfService'];
}

/** Routes a guardian-only account (no club) cannot use: the hidden tabs' roots. */
const CLUB_ONLY_ROUTES: readonly (keyof RootStackParamList)[] = ['Kalender', 'Mitteilungen', 'Verein', 'Standorte', 'ClubApplications', 'ProfileModules', 'Abstimmungen', 'Versammlung', 'Archiv', 'Bestaetigungen', 'AusweisKontrolle'];

/** Where to go after sign-in: `returnTo` only when the account can reach it, otherwise the account's own Heute. */
export function resolveReturnTo(returnTo: keyof RootStackParamList | undefined, ctx: TabContext): keyof RootStackParamList {
  if (ctx.externalRole || ctx.externalPending) return returnTo && externalRoutes(ctx.externalRoles ?? (ctx.externalRole ? [ctx.externalRole] : [])).includes(returnTo) ? returnTo : tabTarget('heute', { ...ctx, isAuthenticated: true });
  if (returnTo && !(ctx.guardianOnly && CLUB_ONLY_ROUTES.includes(returnTo)) && returnTo !== 'Login') return returnTo;
  return tabTarget('heute', { ...ctx, isAuthenticated: true });
}
