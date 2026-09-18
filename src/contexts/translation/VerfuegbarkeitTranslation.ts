import { supportedLanguageIds, type Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// DE/EN authored for now, same documented gap as VereinTranslation.ts -- the
// other 9 languages are aliased to English below.
const authored = {
  de: {
    'kalender.tab.verfuegbarkeit': 'Verfügbarkeit',
    'verfuegbarkeit.weekday.monday': 'Montag',
    'verfuegbarkeit.weekday.tuesday': 'Dienstag',
    'verfuegbarkeit.weekday.wednesday': 'Mittwoch',
    'verfuegbarkeit.weekday.thursday': 'Donnerstag',
    'verfuegbarkeit.weekday.friday': 'Freitag',
    'verfuegbarkeit.weekday.saturday': 'Samstag',
    'verfuegbarkeit.weekday.sunday': 'Sonntag',
    'verfuegbarkeit.available-toggle': 'Verfügbar an diesem Tag',
    'verfuegbarkeit.start-time': 'Von',
    'verfuegbarkeit.end-time': 'Bis',
    'verfuegbarkeit.exceptions.title': 'Ausnahmen',
    'verfuegbarkeit.exceptions.add': 'Ausnahme hinzufügen',
    'verfuegbarkeit.exceptions.date': 'Datum',
    'verfuegbarkeit.exceptions.available': 'Verfügbar',
    'verfuegbarkeit.exceptions.unavailable': 'Nicht verfügbar',
    'verfuegbarkeit.exceptions.note': 'Notiz (optional)',
    'verfuegbarkeit.exceptions.empty': 'Noch keine Ausnahmen erfasst.',
  },
  en: {
    'kalender.tab.verfuegbarkeit': 'Availability',
    'verfuegbarkeit.weekday.monday': 'Monday',
    'verfuegbarkeit.weekday.tuesday': 'Tuesday',
    'verfuegbarkeit.weekday.wednesday': 'Wednesday',
    'verfuegbarkeit.weekday.thursday': 'Thursday',
    'verfuegbarkeit.weekday.friday': 'Friday',
    'verfuegbarkeit.weekday.saturday': 'Saturday',
    'verfuegbarkeit.weekday.sunday': 'Sunday',
    'verfuegbarkeit.available-toggle': 'Available this day',
    'verfuegbarkeit.start-time': 'From',
    'verfuegbarkeit.end-time': 'To',
    'verfuegbarkeit.exceptions.title': 'Exceptions',
    'verfuegbarkeit.exceptions.add': 'Add exception',
    'verfuegbarkeit.exceptions.date': 'Date',
    'verfuegbarkeit.exceptions.available': 'Available',
    'verfuegbarkeit.exceptions.unavailable': 'Not available',
    'verfuegbarkeit.exceptions.note': 'Note (optional)',
    'verfuegbarkeit.exceptions.empty': 'No exceptions yet.',
  },
};

const VerfuegbarkeitTranslation: Translation = Object.fromEntries(
  supportedLanguageIds.map((id) => [id, authored[id as keyof typeof authored] ?? authored.en]),
) as unknown as Translation;

export default VerfuegbarkeitTranslation;
