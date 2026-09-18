import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { LanguageProvider, useLanguage } from './LanguageContext';

jest.mock('./languagePreferenceStorage', () => ({
  getStoredLanguage: jest.fn().mockResolvedValue(null),
  setStoredLanguage: jest.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe('LanguageContext t() fallback (S2)', () => {
  it('falls back to the English value when a key is missing in the active language', async () => {
    const { result } = await renderHook(() => useLanguage(), { wrapper });
    await act(async () => {
      result.current.setLanguage('fr');
    });

    // Real key present in every language -- sanity check French actually renders French.
    expect(result.current.t('settings.title')).toBe('Paramètres');

    // Key that only exists in de/en (LegalTranslation.ts) -- French must
    // fall back to the English value, not the raw key.
    expect(result.current.t('legal.privacy.title')).toBe('Privacy Policy');
  });
});
