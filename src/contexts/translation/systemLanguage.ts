import * as Localization from 'expo-localization';

import { type Language, isSupportedLanguage } from './supportedLanguages';

// Same region-alias rule as the website (see acceptLanguage.ts) -- keep both
// in sync manually if the registry ever changes; not worth a shared package
// for one 10-line function split across two separate repos.
const REGION_ALIASES: Record<string, Language> = {
  'zh-cn': 'zh-Hans',
  'zh-sg': 'zh-Hans',
};

export function detectSystemLanguage(): Language | null {
  for (const locale of Localization.getLocales()) {
    const tag = locale.languageTag?.toLowerCase();
    if (tag && REGION_ALIASES[tag]) return REGION_ALIASES[tag];
    if (isSupportedLanguage(locale.languageTag)) return locale.languageTag as Language;
    if (isSupportedLanguage(locale.languageCode)) return locale.languageCode as Language;
  }
  return null;
}
