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
let mockClub: { suspension?: { since: string | null; note: string | null } | null } | null = null;
jest.mock('@/clubs/ActiveClubProvider', () => ({ useActiveClub: () => ({ activeClub: mockClub }) }));

const ui = () => (
  <LanguageProvider>
    <SuspendedBanner />
  </LanguageProvider>
);
const TITLE = 'Dieser Verein ist vorübergehend gesperrt';

describe('SuspendedBanner', () => {
  it('shows the fixed line, the date and the platform note as plain text', async () => {
    mockClub = { suspension: { since: '2026-11-20T08:00:00.000Z', note: 'Bitte meldet euch beim Support.' } };
    await render(ui());
    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText('Bitte meldet euch beim Support.')).toBeTruthy();
    expect(screen.getByText(/^Seit /)).toBeTruthy();
  });

  it('shows the fixed app text when there is no note', async () => {
    mockClub = { suspension: { since: null, note: null } };
    await render(ui());
    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText(/Inhalte sind gerade nicht erreichbar/)).toBeTruthy();
    expect(screen.queryByText(/^Seit /)).toBeNull();
  });

  it('caps a very long note and renders markup as literal text', async () => {
    mockClub = { suspension: { since: null, note: `<b>Achtung</b> ${'x'.repeat(2000)}` } };
    await render(ui());
    const node = await screen.findByText(/<b>Achtung<\/b> x+/);
    expect(String(node.props.children).length).toBeLessThanOrEqual(400);
    expect(String(node.props.children).endsWith('\u2026')).toBe(true);
  });

  it('shows nothing for an active club or without a club', async () => {
    for (const club of [{ suspension: null }, {}, null]) {
      mockClub = club;
      const { unmount } = await render(ui());
      expect(screen.queryByText(TITLE)).toBeNull();
      await unmount();
    }
  });
});
