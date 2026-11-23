import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import PartnerScreen from '../PartnerScreen';
import EinsatzScreen from '../EinsatzScreen';
import SponsorenScreen from '../SponsorenScreen';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => 'de'), setStoredLanguage: jest.fn(async () => undefined) }));
jest.mock('@/navigation/AppNavigator', () => ({}));
jest.mock('@/navigation/navigationRef', () => ({ navigate: jest.fn(), goToTab: jest.fn() }));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : Icon) });
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/theme/colors', () => ({
  useThemeColors: () => ({
    background: '#fff', foreground: '#000', card: '#fff', muted: '#eee', mutedForeground: '#777', border: '#ccc', primaryText: '#00f',
    primary: '#00f', primaryForeground: '#fff', accent: '#0ff', accentForeground: '#000', destructive: '#f00', success: '#0f0', warning: '#fa0',
  }),
}));
jest.mock('@/components/verein/ClubSwitcher', () => () => null);
jest.mock('@/components/verein/ClubsLoadError', () => () => null);
jest.mock('@/components/verein/SuspendedBanner', () => () => null);
jest.mock('@/components/onboarding/NoClubChoices', () => () => null);

let mockAccess: Record<string, unknown> = {};
jest.mock('@/external/ExternalAccessProvider', () => ({ useExternalAccess: () => mockAccess }));
let mockPublic: Record<string, unknown> = {};
jest.mock('@/hooks/usePublicClub', () => ({ usePublicClub: () => mockPublic }));
let mockClubs: Record<string, unknown> = {};
jest.mock('@/hooks/useMyClubs', () => ({ useMyClubs: () => mockClubs }));
let mockPerms: string[] = [];
jest.mock('@/hooks/useOwnMembership', () => ({ useOwnMembership: () => ({ can: (p: string) => mockPerms.includes(p), loading: false }) }));
let mockSponsors: Record<string, unknown> = {};
const mockSponsorsHook = jest.fn((..._args: unknown[]) => mockSponsors);
jest.mock('@/hooks/useSponsors', () => ({ useSponsors: (...a: unknown[]) => mockSponsorsHook(...a) }));

const reload = jest.fn(async () => undefined);
const wrap = (ui: React.ReactElement) => <LanguageProvider>{ui}</LanguageProvider>;
const access = (over: Record<string, unknown>) => ({ role: 'sponsor', roles: ['sponsor'], me: null, loading: false, error: null, reduced: true, reload, ...over });
const meWith = (over: Record<string, unknown>) => ({ clubId: 'g', clubName: 'TSV Ost', clubSlug: 'tsv', externalOnly: true, roleTypes: ['sponsor'], sponsors: [], assignments: [], ...over });
const sponsor = { id: 's1', name: 'Bäckerei Frei', website: null, description: null, consideration: 'Bandenwerbung', startsOn: null, endsOn: '2026-12-31', visibility: 'intern', status: 'aktiv', expiringSoon: false, daysLeft: null, logoUrl: null, contacts: [], linkedAccountName: null };

beforeEach(() => {
  reload.mockClear();
  mockPublic = { info: null, missing: true, loading: false, error: null, reload };
  mockClubs = { activeClub: { clubId: 'c1' }, loading: false, error: false };
  mockPerms = [];
  mockSponsors = { sponsors: null, loading: false, error: null, reload };
  mockSponsorsHook.mockClear();
});

describe('Partner', () => {
  it('shows the designed empty state without an entry', async () => {
    mockAccess = access({ me: meWith({}) });
    await render(wrap(<PartnerScreen />));
    expect(await screen.findByText('Noch kein Eintrag')).toBeTruthy();
  });

  it('shows the own entry and the Einsatz row for an account with both roles', async () => {
    mockAccess = access({ roles: ['sponsor', 'dienstleister'], me: meWith({ sponsors: [sponsor] }) });
    await render(wrap(<PartnerScreen />));
    expect((await screen.findAllByText('Bäckerei Frei')).length).toBeGreaterThan(0);
    expect(screen.getByText('Einsatz')).toBeTruthy();
  });

  it('shows an error state with retry while the role is unknown', async () => {
    mockAccess = access({ role: null, roles: [], error: new Error('offline') });
    await render(wrap(<PartnerScreen />));
    fireEvent.press(await screen.findByText('Erneut versuchen'));
    expect(reload).toHaveBeenCalled();
  });
});

describe('Einsatz', () => {
  const t0 = Date.now();
  const row = (id: string, from: number, until: number, extra: Record<string, unknown> = {}) => ({ id, title: id, note: null, validFrom: new Date(from).toISOString(), validUntil: new Date(until).toISOString(), active: true, location: null, ...extra });

  it('shows the empty state', async () => {
    mockAccess = access({ role: 'dienstleister', roles: ['dienstleister'], me: meWith({}) });
    await render(wrap(<EinsatzScreen />));
    expect(await screen.findByText('Gerade nichts freigegeben')).toBeTruthy();
  });

  it('shows an error state with retry', async () => {
    mockAccess = access({ role: 'dienstleister', roles: ['dienstleister'], error: new Error('x') });
    await render(wrap(<EinsatzScreen />));
    fireEvent.press(await screen.findByText('Erneut versuchen'));
    expect(reload).toHaveBeenCalled();
  });

  it('shows place and note while the window is open and hides them when it ends with the screen still open', async () => {
    jest.useFakeTimers();
    try {
      const loc = { id: 'l', name: 'Sporthalle Nord', address: 'Weg 1' };
      mockAccess = access({ role: 'dienstleister', roles: ['dienstleister'], me: meWith({ assignments: [row('Heizung warten', t0 - 3_600_000, t0 + 60_000, { note: 'Schlüssel beim Hausmeister', location: loc })] }) });
      await render(wrap(<EinsatzScreen />));
      expect(screen.getByText('Sporthalle Nord')).toBeTruthy();
      expect(screen.getByText('Schlüssel beim Hausmeister')).toBeTruthy();
      await act(async () => {
        jest.setSystemTime(t0 + 120_000);
        jest.advanceTimersByTime(61_000);
      });
      expect(screen.queryByText('Sporthalle Nord')).toBeNull();
      expect(screen.queryByText('Schlüssel beim Hausmeister')).toBeNull();
      expect(reload).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Sponsoren', () => {
  it('shows no list and sends no request without the permission', async () => {
    await render(wrap(<SponsorenScreen />));
    expect(await screen.findByText('Die Sponsorenliste ist für den Vorstand.')).toBeTruthy();
    expect(mockSponsorsHook).toHaveBeenCalledWith('c1', false);
  });

  it('shows the empty state for a board member', async () => {
    mockPerms = ['sponsors:read'];
    mockSponsors = { sponsors: [], loading: false, error: null, reload };
    await render(wrap(<SponsorenScreen />));
    expect(await screen.findByText('Noch keine Sponsoren')).toBeTruthy();
  });

  it('shows an error state with retry', async () => {
    mockPerms = ['sponsors:read'];
    mockSponsors = { sponsors: null, loading: false, error: new Error('x'), reload };
    await render(wrap(<SponsorenScreen />));
    fireEvent.press(await screen.findByText('Erneut versuchen'));
    expect(reload).toHaveBeenCalled();
  });

  it('lists sponsors grouped by status', async () => {
    mockPerms = ['sponsors:write'];
    mockSponsors = { sponsors: [sponsor, { ...sponsor, id: 's2', name: 'Alt GmbH', status: 'abgelaufen' }], loading: false, error: null, reload };
    await render(wrap(<SponsorenScreen />));
    expect(await screen.findByText('Bäckerei Frei')).toBeTruthy();
    expect(screen.getByText('Abgelaufen')).toBeTruthy();
    expect(screen.getByText('Alt GmbH')).toBeTruthy();
  });
});
