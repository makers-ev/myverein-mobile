import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import { PaletteProvider } from '@/theme/PaletteProvider';
import ListSection from '@/components/ui/ListSection';
import ListRow from '@/components/ui/ListRow';
import { navigate } from '@/navigation/navigationRef';
import { dismissSetupChecklist, getDismissedSetupClubs } from '@/settings/setupChecklistStorage';
import SetupChecklist from './SetupChecklist';
import BoardSection, { requestsRow } from './BoardSection';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => null), setStoredLanguage: jest.fn(async () => undefined) }));
jest.mock('@/navigation/navigationRef', () => ({ navigate: jest.fn(), goToTab: jest.fn() }));
jest.mock('@/settings/setupChecklistStorage', () => ({ getDismissedSetupClubs: jest.fn(async () => []), dismissSetupChecklist: jest.fn(async () => undefined) }));
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]) };
});
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : Icon) });
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined), multiGet: jest.fn(async () => []) } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined), deleteItemAsync: jest.fn(async () => undefined) }));

const wrap = (ui: React.ReactElement) => (
  <PaletteProvider>
    <LanguageProvider>{ui}</LanguageProvider>
  </PaletteProvider>
);

describe('SetupChecklist', () => {
  it('shows the open steps below 4 done steps and hides + stores on "Hide"', async () => {
    await render(wrap(<SetupChecklist clubId="c1" setup={{ done: ['logo', 'departments'], open: ['calendar', 'location', 'members'] }} />));
    expect(await screen.findByText('Set up your club')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(dismissSetupChecklist).toHaveBeenCalledWith('c1'));
    expect(screen.queryByText('Set up your club')).toBeNull();
  });

  it('is a single progress row from 4 of 5 steps on and expands on tap', async () => {
    await render(wrap(<SetupChecklist clubId="c1" setup={{ done: ['departments', 'calendar', 'location', 'members'], open: ['logo'] }} />));
    expect(await screen.findByText('Set up your club · 4 of 5')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Set up your club · 4 of 5/ }));
    expect(await screen.findByRole('button', { name: 'Show less' })).toBeTruthy();
  });

  it('renders nothing when the club was hidden before', async () => {
    (getDismissedSetupClubs as jest.Mock).mockResolvedValueOnce(['c1']);
    await render(wrap(<SetupChecklist clubId="c1" setup={{ done: [], open: ['logo'] }} />));
    await waitFor(() => expect(getDismissedSetupClubs).toHaveBeenCalled());
    expect(screen.queryByText('Set up your club')).toBeNull();
  });
});

describe('ListSection', () => {
  it('renders nothing at all without any row (permission-gated entries)', async () => {
    await render(wrap(<ListSection title="Leerer Titel">{null}</ListSection>));
    expect(screen.queryByText('Leerer Titel')).toBeNull();
  });
  it('renders its title and rows otherwise', async () => {
    await render(
      wrap(
        <ListSection title="Titel">
          <ListRow title="Zeile" />
        </ListSection>,
      ),
    );
    expect(await screen.findByText('Titel')).toBeTruthy();
    expect(screen.getByText('Zeile')).toBeTruthy();
  });
});

describe('BoardSection', () => {
  it('sums applications and exits into one row and sends exits to Verwaltung', async () => {
    expect(requestsRow({ openApplications: 3, openExits: 2 }, false)).toEqual({ count: 5, route: 'Verein' });
    expect(requestsRow({ openApplications: 3 }, false)).toEqual({ count: 3, route: 'ClubApplications' });
    expect(requestsRow({ openApplications: 3, openExits: 2 }, true)).toEqual({ count: 2, route: 'Verein' });
    await render(wrap(<BoardSection board={{ openApplications: 3, openExits: 2 }} />));
    fireEvent.press(await screen.findByRole('button', { name: /Applications and exits/ }));
    expect(navigate).toHaveBeenCalledWith('Verein', { tab: 'verwaltung' });
  });
  it('goes straight to the review list for applications only', async () => {
    await render(wrap(<BoardSection board={{ openApplications: 1 }} />));
    fireEvent.press(await screen.findByRole('button', { name: /Applications and exits/ }));
    expect(navigate).toHaveBeenCalledWith('ClubApplications');
  });
});
