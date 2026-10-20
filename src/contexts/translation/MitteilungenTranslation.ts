import type { Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// Club inbox ("Mitteilungen", Wave 9 M1) and notification settings (M4). de/en only; other
// languages fall back to English per key (see LanguageContext's `t()`).
const MitteilungenTranslation: Translation = {
  en: {
    'nav.mitteilungen': 'Messages',
    'mitteilungen.title': 'Club messages',
    'mitteilungen.urgent': 'Urgent',
    'mitteilungen.pinned': 'Pinned',
    'mitteilungen.unread': 'New',
    'mitteilungen.close': 'Close',
    'mitteilungen.empty.title': 'No messages yet',
    'mitteilungen.empty.body': 'Announcements from your club will appear here. Pull down to refresh.',
    'mitteilungen.refresh-failed': 'Refreshing failed. Showing the last loaded messages.',

    'notifications.platform-hint': 'These are notices from the MyVerein platform. Messages from your club are under "Messages".',

    'settings.section-notifications': 'Notifications',
    'settings.notifications.description': 'Choose how you want to hear from your clubs. These settings apply to all your clubs.',
    'settings.notifications.category.announcements': 'Announcements',
    'settings.notifications.category.events': 'Event changes and cancellations',
    'settings.notifications.category.reminders': 'Reminders',
    'settings.notifications.channel.in_app': 'In the app',
    'settings.notifications.channel.email': 'E-mail',
    'settings.notifications.channel.push': 'Push',
    'settings.notifications.always-on': 'always on',
    'settings.notifications.push-hint': 'Push notifications are not available in this app version yet. Your choice is saved and applies as soon as they are.',
    'settings.notifications.mandatory.title': 'Always delivered',
    'settings.notifications.mandatory.body': 'Important notices cannot be switched off: account security, decisions about you and deadlines of invitations.',
    'settings.notifications.error': 'Could not load or save your notification settings.',
    'settings.notifications.save-error': 'Could not save. Your previous setting was restored.',
  },
  de: {
    'nav.mitteilungen': 'Mitteilungen',
    'mitteilungen.title': 'Vereinsmitteilungen',
    'mitteilungen.urgent': 'Dringend',
    'mitteilungen.pinned': 'Angepinnt',
    'mitteilungen.unread': 'Neu',
    'mitteilungen.close': 'Schließen',
    'mitteilungen.empty.title': 'Noch keine Mitteilungen',
    'mitteilungen.empty.body': 'Ankündigungen deines Vereins erscheinen hier. Zum Aktualisieren nach unten ziehen.',
    'mitteilungen.refresh-failed': 'Aktualisieren fehlgeschlagen. Die zuletzt geladenen Mitteilungen werden angezeigt.',

    'notifications.platform-hint': 'Das sind Hinweise der MyVerein-Plattform. Nachrichten deines Vereins findest du unter "Mitteilungen".',

    'settings.section-notifications': 'Benachrichtigungen',
    'settings.notifications.description': 'Lege fest, wie dein Verein dich erreichen darf. Die Einstellungen gelten für alle deine Vereine.',
    'settings.notifications.category.announcements': 'Ankündigungen',
    'settings.notifications.category.events': 'Terminänderungen und Absagen',
    'settings.notifications.category.reminders': 'Erinnerungen',
    'settings.notifications.channel.in_app': 'In der App',
    'settings.notifications.channel.email': 'E-Mail',
    'settings.notifications.channel.push': 'Push',
    'settings.notifications.always-on': 'immer an',
    'settings.notifications.push-hint': 'Push-Benachrichtigungen gibt es in dieser App-Version noch nicht. Deine Auswahl wird gespeichert und gilt, sobald sie verfügbar sind.',
    'settings.notifications.mandatory.title': 'Wird immer zugestellt',
    'settings.notifications.mandatory.body': 'Wichtige Hinweise lassen sich nicht abschalten: Kontosicherheit, Entscheidungen über dich und Fristen von Einladungen.',
    'settings.notifications.error': 'Deine Benachrichtigungseinstellungen konnten nicht geladen oder gespeichert werden.',
    'settings.notifications.save-error': 'Speichern fehlgeschlagen. Die vorherige Einstellung wurde wiederhergestellt.',
  },
  fr: {},
  es: {},
  pt: {},
  it: {},
  nl: {},
  pl: {},
  ru: {},
  ja: {},
  'zh-Hans': {},
};

export default MitteilungenTranslation;
