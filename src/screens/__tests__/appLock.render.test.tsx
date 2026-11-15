import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import { PaletteProvider } from '@/theme/PaletteProvider';
import AppLockScreen from '../AppLockScreen';

jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => null), setStoredLanguage: jest.fn(async () => undefined) }));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : Icon) });
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined), multiGet: jest.fn(async () => []) } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined), deleteItemAsync: jest.fn(async () => undefined) }));

const mount = (onUnlock = jest.fn()) => render(
  <PaletteProvider>
    <LanguageProvider>
      <AppLockScreen pin="1234" onUnlock={onUnlock} />
    </LanguageProvider>
  </PaletteProvider>,
);
const tap = async (digits: string) => {
  for (const d of digits) await fireEvent.press(screen.getByRole('button', { name: d }));
};

describe('PIN pad', () => {
  it('counts the entered digits for screen readers and deletes the last one', async () => {
    await mount();
    expect(await screen.findByLabelText('0 of 4 digits entered')).toBeTruthy();
    await tap('12');
    expect(screen.getByLabelText('2 of 4 digits entered')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete last digit' }));
    expect(screen.getByLabelText('1 of 4 digits entered')).toBeTruthy();
  });

  it('unlocks with the right PIN', async () => {
    const onUnlock = jest.fn();
    await mount(onUnlock);
    await tap('1234');
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('clears a wrong PIN, counts down and locks the keys after five failures', async () => {
    const onUnlock = jest.fn();
    await mount(onUnlock);
    expect(await screen.findByText('5 attempt(s) remaining.')).toBeTruthy();
    await tap('0000');
    expect(await screen.findByText('4 attempt(s) remaining.')).toBeTruthy();
    expect(screen.getByLabelText('0 of 4 digits entered')).toBeTruthy();
    for (let i = 0; i < 4; i++) await tap('0000');
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '1' }).props.accessibilityState?.disabled).toBe(true);
    await tap('1234');
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
