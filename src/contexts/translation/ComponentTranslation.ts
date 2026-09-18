import type { Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// fr/es/pt/it/nl/pl/ru/ja/zh-Hans are first-pass AI translation (ADR-009),
// pending native-speaker review.
const ComponentTranslation: Translation = {
  en: {
    'confirmation-input-modal.input-placeholder': 'Confirm your action...',
  },
  de: {
    'confirmation-input-modal.input-placeholder': 'Bestätige deine Aktion...',
  },
  fr: {
    'confirmation-input-modal.input-placeholder': 'Confirmez votre action...',
  },
  es: {
    'confirmation-input-modal.input-placeholder': 'Confirma tu acción...',
  },
  pt: {
    'confirmation-input-modal.input-placeholder': 'Confirme sua ação...',
  },
  it: {
    'confirmation-input-modal.input-placeholder': 'Conferma la tua azione...',
  },
  nl: {
    'confirmation-input-modal.input-placeholder': 'Bevestig je actie...',
  },
  pl: {
    'confirmation-input-modal.input-placeholder': 'Potwierdź swoją akcję...',
  },
  ru: {
    'confirmation-input-modal.input-placeholder': 'Подтвердите действие...',
  },
  ja: {
    'confirmation-input-modal.input-placeholder': '操作を確認してください...',
  },
  'zh-Hans': {
    'confirmation-input-modal.input-placeholder': '确认您的操作……',
  },
};

export default ComponentTranslation;
