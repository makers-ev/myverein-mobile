import React from 'react';
import { render } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import { PaletteProvider } from '@/theme/PaletteProvider';
import { WardsProvider } from '@/guardian/WardsProvider';
import VersammlungScreen from '../VersammlungScreen';
import AbstimmungenScreen from '../AbstimmungenScreen';
import BestaetigungenScreen from '../BestaetigungenScreen';
import ArchivScreen from '../ArchivScreen';
import MitgliedsausweisScreen from '../MitgliedsausweisScreen';
import MehrScreen from '../MehrScreen';
import HeuteScreen from '../HeuteScreen';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', name: 'Max', email: 'm@x.de' }, session: { user: { id: 'u1' } }, isPending: false }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => null), setStoredLanguage: jest.fn(async () => undefined) }));
const mockClubState = {
  clubs: [{ clubId: 'c1', memberId: 'm1', clubName: 'TSV Test', orgRole: 'member' }] as unknown[],
  activeClub: { clubId: 'c1', memberId: 'm1', clubName: 'TSV Test', orgRole: 'member' } as unknown,
  loading: false,
  error: false,
  refetch: jest.fn(async () => undefined),
  setActiveClubId: jest.fn(),
};
jest.mock('@/clubs/ActiveClubProvider', () => ({ useActiveClub: () => mockClubState, ActiveClubProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    useIsFocused: () => true,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => () => undefined) }),
    useRoute: () => ({ params: undefined }),
  };
});
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
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined), multiGet: jest.fn(async () => []) } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined), deleteItemAsync: jest.fn(async () => undefined) }));
const apiFetchMock = apiFetch as jest.Mock;

const meeting = { id: 'mt1', clubId: 'c1', type: 'mitgliederversammlung', title: 'Jahreshauptversammlung', scheduledAt: '2026-05-01T18:00:00Z', agenda: null, minutes: null, status: 'geplant', createdBy: 'u1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };

const card = {
  clubMemberId: 'm1', cardId: 'c1', issued: true, state: 'gueltig', hint: null, validUntil: null, issuedAt: null, token: 'tok-abcdefghijklmnop', tokenExpiresAt: null,
  member: { displayName: 'Mia', memberNumber: null, category: null, initials: 'M' }, club: { name: 'TSV', primaryColor: null, accentColor: null, logo: null },
  photo: null, photoConsent: false, checkedAt: '2026-10-28T12:00:00Z',
};

type Mode = 'data' | 'empty' | 'error' | 'pending' | 'objectData' | 'bareArray' | 'numberDate';
function mockApi(mode: Mode) {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (mode === 'pending') return new Promise(() => undefined);
    if (mode === 'error') throw new Error('boom');
    if (String(path).startsWith('/meetings?') && mode === 'data') return { data: [meeting] };
    if (String(path).startsWith('/meetings?') && mode === 'bareArray') return [meeting];
    if (String(path).startsWith('/meetings?') && mode === 'objectData') return { data: { items: [meeting] } };
    if (String(path).startsWith('/meetings?') && mode === 'numberDate') return { data: [{ ...meeting, scheduledAt: 1777658400000 }, { ...meeting, id: 'mt2', scheduledAt: null }] };
    if (/\/card\?/.test(String(path))) return { data: card };
    return { data: [] };
  });
}

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => () => undefined) };
const screens: [string, React.ComponentType<any>, any][] = [
  ['Versammlung (no params)', VersammlungScreen, { route: { key: 'k', name: 'Versammlung' }, navigation: nav }],
  ['Versammlung (meetingId)', VersammlungScreen, { route: { key: 'k', name: 'Versammlung', params: { meetingId: 'mt1' } }, navigation: nav }],
  ['Abstimmungen', AbstimmungenScreen, { route: { key: 'k', name: 'Abstimmungen' }, navigation: nav }],
  ['Bestaetigungen', BestaetigungenScreen, { route: { key: 'k', name: 'Bestaetigungen' }, navigation: nav }],
  ['Archiv', ArchivScreen, { route: { key: 'k', name: 'Archiv' }, navigation: nav }],
  ['Mitgliedsausweis', MitgliedsausweisScreen, { route: { key: 'k', name: 'Mitgliedsausweis' }, navigation: nav }],
  ['Mehr', MehrScreen, { route: { key: 'k', name: 'Mehr' }, navigation: nav }],
  ['Heute', HeuteScreen, { route: { key: 'k', name: 'Heute' }, navigation: nav }],
];

describe.each(['data', 'empty', 'error', 'pending', 'objectData', 'bareArray', 'numberDate'] as Mode[])('assembly-class screens render (%s)', (mode) => {
  it.each(screens)('%s', async (_n, Screen, props) => {
    mockApi(mode);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let thrown: unknown = null;
    try {
      await render(
        <LanguageProvider>
          <PaletteProvider>
            <WardsProvider>
              <Screen {...props} />
            </WardsProvider>
          </PaletteProvider>
        </LanguageProvider>,
      );
    } catch (e) {
      thrown = e;
    }
    spy.mockRestore();
    expect(thrown).toBeNull();
  });
});
