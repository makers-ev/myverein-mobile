import { supportedLanguageIds, type Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// DE/EN authored for now, same documented gap as VereinTranslation.ts --
// the other 9 languages are aliased to English below.
const authored = {
  de: {
    'nav.kalender': 'Kalender',
    'kalender.tab.termine': 'Termine',
    'termine.empty': 'Keine anstehenden Termine.',
    'termine.capacity': '{{capacity}} Plätze',
    'termine.rsvp': 'Anmelden',
    'termine.rsvp.confirmed': 'Angemeldet',
    'termine.rsvp.waitlist': 'Auf der Warteliste',
    'termine.cancel': 'Abmelden',
  },
  en: {
    'nav.kalender': 'Calendar',
    'kalender.tab.termine': 'Events',
    'termine.empty': 'No upcoming events.',
    'termine.capacity': '{{capacity}} spots',
    'termine.rsvp': 'Sign up',
    'termine.rsvp.confirmed': 'Signed up',
    'termine.rsvp.waitlist': 'On the waitlist',
    'termine.cancel': 'Cancel',
  },
};

const KalenderTranslation: Translation = Object.fromEntries(
  supportedLanguageIds.map((id) => [id, authored[id as keyof typeof authored] ?? authored.en]),
) as unknown as Translation;

export default KalenderTranslation;
