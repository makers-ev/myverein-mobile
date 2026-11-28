import React from 'react';
import { act, render } from '@testing-library/react-native';

import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import KalenderScreen from './KalenderScreen';

const mockMembership = jest.fn();
const mockTarget = jest.fn();
const mockExternal = jest.fn();
let lastCommand: { kind: string; n: number } | null | undefined;

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => null), setStoredLanguage: jest.fn(async () => undefined) }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useRoute: () => ({ params: undefined }) }));
jest.mock('@/navigation/AppNavigator', () => ({}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : Icon) });
});
jest.mock('@/theme/colors', () => ({ useThemeColors: () => ({ primaryText: '#00f', mutedForeground: '#777' }) }));
jest.mock('@/hooks/useMyClubs', () => ({ useMyClubs: () => ({ activeClub: { clubId: 'club' }, error: null, loading: false }) }));
jest.mock('@/hooks/useOwnMembership', () => ({ useOwnMembership: () => mockMembership() }));
jest.mock('@/notifications/usePushScreenTarget', () => ({ usePushScreenTarget: () => mockTarget() }));
jest.mock('@/external/ExternalAccessProvider', () => ({ useExternalAccess: () => mockExternal() }));
jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));
jest.mock('@/components/verein/ClubSwitcher', () => () => null);
jest.mock('@/components/kalender/VerfuegbarkeitTab', () => () => null);
jest.mock('@/components/kalender/TreffenTab', () => () => null);
jest.mock('@/components/kalender/TermineTab', () => ({
  __esModule: true,
  default: (props: { command?: { kind: string; n: number } | null }) => {
    lastCommand = props.command;
    return null;
  },
}));

const consume = jest.fn();
const timeTarget = { target: { kind: 'time', clubId: 'club' }, ready: true, unreachable: false, consume };
const member = (canTrack: boolean) => ({ membership: { roles: [], permissions: [], canTrack }, can: () => false, loading: false });

beforeEach(() => {
  lastCommand = undefined;
  consume.mockReset();
  mockTarget.mockReturnValue(timeTarget);
  mockExternal.mockReturnValue({ reduced: false });
});

const mount = () =>
  render(
    <LanguageProvider>
      <KalenderScreen />
    </LanguageProvider>,
  );

describe('KalenderScreen time-entry push', () => {
  it('queues the time stamp for a member who may track time', async () => {
    mockMembership.mockReturnValue(member(true));
    await mount();
    await act(async () => {});
    expect(consume).toHaveBeenCalled();
    expect(lastCommand?.kind).toBe('time');
  });

  it('still opens the time stamp without a current rate (own entry must stay correctable)', async () => {
    mockMembership.mockReturnValue(member(false));
    const screen = await mount();
    await act(async () => {});
    expect(lastCommand?.kind).toBe('time');
    expect(screen.queryByText(/Time tracking is not available/)).toBeNull();
  });

  it('waits for the membership before deciding', async () => {
    mockMembership.mockReturnValue({ membership: null, can: () => false, loading: true });
    const screen = await mount();
    await act(async () => {});
    expect(lastCommand ?? null).toBeNull();
    expect(screen.queryByText(/Time tracking is not available/)).toBeNull();
    mockMembership.mockReturnValue(member(true));
    await screen.rerender(
      <LanguageProvider>
        <KalenderScreen />
      </LanguageProvider>,
    );
    await act(async () => {});
    expect(lastCommand?.kind).toBe('time');
  });

  it('never opens the time stamp for a reduced external account', async () => {
    mockExternal.mockReturnValue({ reduced: true });
    mockMembership.mockReturnValue(member(true));
    const screen = await mount();
    await act(async () => {});
    expect(lastCommand ?? null).toBeNull();
    expect(screen.queryByText(/Time tracking is not available/)).toBeNull();
  });

  it('ignores a push of a club the user is no longer in (screen shows the club notice)', async () => {
    mockTarget.mockReturnValue({ target: { kind: 'time', clubId: 'other' }, ready: false, unreachable: true, consume });
    mockMembership.mockReturnValue(member(true));
    const screen = await mount();
    await act(async () => {});
    expect(lastCommand ?? null).toBeNull();
    expect(screen.getByText(/no longer a member/)).toBeTruthy();
  });
});
