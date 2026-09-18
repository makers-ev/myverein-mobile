// Single source of truth for every language this app's `t()`-pattern
// supports (see ADR-009). `type Language` is derived from this list --
// adding a language is "append here + add object keys in the translation
// files", no other file needs to know the union of valid codes.
export const supportedLanguages = [
  { id: 'de', label: 'German', nativeLabel: 'Deutsch', isRTL: false },
  { id: 'en', label: 'English', nativeLabel: 'English', isRTL: false },
  { id: 'fr', label: 'French', nativeLabel: 'Français', isRTL: false },
  { id: 'es', label: 'Spanish', nativeLabel: 'Español', isRTL: false },
  { id: 'pt', label: 'Portuguese', nativeLabel: 'Português', isRTL: false },
  { id: 'it', label: 'Italian', nativeLabel: 'Italiano', isRTL: false },
  { id: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', isRTL: false },
  { id: 'pl', label: 'Polish', nativeLabel: 'Polski', isRTL: false },
  { id: 'ru', label: 'Russian', nativeLabel: 'Русский', isRTL: false },
  { id: 'ja', label: 'Japanese', nativeLabel: '日本語', isRTL: false },
  { id: 'zh-Hans', label: 'Chinese (Simplified)', nativeLabel: '简体中文', isRTL: false },
] as const;

export type Language = (typeof supportedLanguages)[number]['id'];

export const supportedLanguageIds = supportedLanguages.map((l) => l.id) as Language[];

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (supportedLanguageIds as string[]).includes(value);
}
