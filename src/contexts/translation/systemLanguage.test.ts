import { detectSystemLanguage } from './systemLanguage';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

import * as Localization from 'expo-localization';

describe('detectSystemLanguage', () => {
  it('picks the first supported locale, respecting device order', () => {
    (Localization.getLocales as jest.Mock).mockReturnValue([
      { languageTag: 'fr-CA', languageCode: 'fr' },
      { languageTag: 'de-DE', languageCode: 'de' },
    ]);
    expect(detectSystemLanguage()).toBe('fr');
  });

  it('maps common Chinese region variants onto zh-Hans', () => {
    (Localization.getLocales as jest.Mock).mockReturnValue([{ languageTag: 'zh-CN', languageCode: 'zh' }]);
    expect(detectSystemLanguage()).toBe('zh-Hans');
  });

  it('returns null when nothing matches', () => {
    (Localization.getLocales as jest.Mock).mockReturnValue([{ languageTag: 'ko-KR', languageCode: 'ko' }]);
    expect(detectSystemLanguage()).toBeNull();
  });
});
