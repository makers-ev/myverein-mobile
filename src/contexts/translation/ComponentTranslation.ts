import type { Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// fr/es/pt/it/nl/pl/ru/ja/zh-Hans are first-pass AI translation (ADR-009),
// pending native-speaker review. ui.* keys are DE/EN only, other languages fall back to EN via t().
const ComponentTranslation: Translation = {
  en: {
    'confirmation-input-modal.input-placeholder': 'Confirm your action...',
    'ui.save': 'Save',
    'ui.cancel': 'Cancel',
    'ui.delete': 'Delete',
    'ui.done': 'Done',
    'ui.today': 'Today',
    'ui.time': 'Time',
    'ui.pick-date': 'Pick a date',
    'ui.clear': 'Clear',
  },
  de: {
    'confirmation-input-modal.input-placeholder': 'Bestätige deine Aktion...',
    'ui.save': 'Speichern',
    'ui.cancel': 'Abbrechen',
    'ui.delete': 'Löschen',
    'ui.done': 'Fertig',
    'ui.today': 'Heute',
    'ui.time': 'Uhrzeit',
    'ui.pick-date': 'Datum wählen',
    'ui.clear': 'Leeren',
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
