import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import SuspendedBanner from './SuspendedBanner';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => 'de'), setStoredLanguage: jest.fn(async () => undefined) }));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : Icon) });
});
jest.mock('@/theme/colors', () => ({ useThemeColors: () => new Proxy({}, { get: () => '#000' }) }));
let mockClub: { suspended?: boolean } | null = null;
jest.mock('@/clubs/ActiveClubProvider', () => ({ useActiveClub: () => ({ activeClub: mockClub }) }));

const ui = () => (
  <LanguageProvider>
    <SuspendedBanner />
  </LanguageProvider>
);

describe('SuspendedBanner', () => {
  it('shows the fixed notice for a suspended club', async () => {
    mockClub = { suspended: true };
    await render(ui());
    expect(await screen.findByText('Verein vorübergehend gesperrt')).toBeTruthy();
  });
  it('shows nothing for an active club, without a club or from an older server', async () => {
    for (const club of [{ suspended: false }, {}, null]) {
      mockClub = club;
      const { unmount } = await render(ui());
      expect(screen.queryByText('Verein vorübergehend gesperrt')).toBeNull();
      await unmount();
    }
  });
});
