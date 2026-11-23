import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import { PaletteProvider } from '@/theme/PaletteProvider';
import TwoFactorScreen from '../TwoFactorScreen';
import CardCheckResult from '@/components/memberCard/CardCheckResult';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => null), setStoredLanguage: jest.fn(async () => undefined) }));
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

const wrap = (ui: React.ReactElement) => (
  <PaletteProvider>
    <LanguageProvider>{ui}</LanguageProvider>
  </PaletteProvider>
);

describe('TwoFactorScreen', () => {
  it('keeps the button disabled until a code is typed and verifies once', async () => {
    const onVerify = jest.fn(async () => ({ success: true }));
    await render(wrap(<TwoFactorScreen onVerify={onVerify} />));
    const button = await screen.findByRole('button', { name: 'Verify' });
    expect(button.props.accessibilityState?.disabled ?? button.props['aria-disabled']).toBeTruthy();
    fireEvent.press(button);
    expect(onVerify).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByDisplayValue(''), '123456');
    fireEvent.press(await screen.findByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith('123456'));
  });
});

describe('CardCheckResult', () => {
  const answer = (result: string) => ({ kind: 'result' as const, notACard: false, answer: { result, member: result === 'gueltig' ? { displayName: 'Clara Kraft', category: 'Aktiv', initials: 'CK', photo: null } : undefined } });
  it.each([
    ['gueltig', 'VALID'],
    ['abgelaufen', 'EXPIRED'],
    ['ausgetreten', 'LEFT THE CLUB'],
    ['ungueltig', 'NOT VALID'],
  ])('shows %s as a word and offers the next check', async (result, word) => {
    const onNext = jest.fn();
    await render(wrap(<CardCheckResult phase={answer(result) as any} onNext={onNext} onRetry={jest.fn()} canRetry={false} />));
    expect(await screen.findByText(word)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Check next card' }));
    expect(onNext).toHaveBeenCalled();
  });
});
