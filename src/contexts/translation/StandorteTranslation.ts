import { supportedLanguageIds, type Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// DE/EN authored for now (documented gap, see Wave 1 Implementation Plan --
// fr/es/pt/it/nl/pl/ru/ja/zh-Hans pending a real translation pass). The
// other 9 languages are explicitly aliased to the English strings below
// instead of just relying on t()'s runtime English fallback, purely so this
// module still type-checks as a complete `Translation` like every other one
// here -- the displayed text is identical either way.
const authored = {
  de: {
    'nav.standorte': 'Standorte',
    'standorte.title': 'Standorte',
    'standorte.list.empty': 'Noch keine Standorte hinterlegt.',
    'standorte.back': 'Zurück',
    'standorte.detail.address': 'Adresse',
    'standorte.detail.directions': 'Route anzeigen',
    'standorte.detail.opening-hours': 'Öffnungszeiten',
    'standorte.detail.contact': 'Ansprechpartner',
    'standorte.detail.access-note': 'Zugangshinweis',
    'standorte.detail.key-holders': 'Schlüsselinhaber',
    'standorte.detail.key-holders.empty': 'Keine Schlüsselinhaber hinterlegt.',
    'standorte.detail.key-holders.count': '{{count}} Schlüsselinhaber',
    'standorte.detail.wifi': 'WLAN',
    'standorte.detail.wifi.empty': 'Kein WLAN hinterlegt.',
    'standorte.wifi.show-qr': 'QR-Code anzeigen',
    'standorte.wifi.hide-qr': 'QR-Code verbergen',
    'standorte.wifi.password': 'Passwort',
    'standorte.detail.links': 'Links',
    'standorte.detail.links.empty': 'Keine Links hinterlegt.',
  },
  en: {
    'nav.standorte': 'Locations',
    'standorte.title': 'Locations',
    'standorte.list.empty': 'No locations yet.',
    'standorte.back': 'Back',
    'standorte.detail.address': 'Address',
    'standorte.detail.directions': 'Get directions',
    'standorte.detail.opening-hours': 'Opening hours',
    'standorte.detail.contact': 'Contact',
    'standorte.detail.access-note': 'Access note',
    'standorte.detail.key-holders': 'Key holders',
    'standorte.detail.key-holders.empty': 'No key holders on file.',
    'standorte.detail.key-holders.count': '{{count}} key holders',
    'standorte.detail.wifi': 'WiFi',
    'standorte.detail.wifi.empty': 'No WiFi networks on file.',
    'standorte.wifi.show-qr': 'Show QR code',
    'standorte.wifi.hide-qr': 'Hide QR code',
    'standorte.wifi.password': 'Password',
    'standorte.detail.links': 'Links',
    'standorte.detail.links.empty': 'No links on file.',
  },
};

const StandorteTranslation: Translation = Object.fromEntries(
  supportedLanguageIds.map((id) => [id, authored[id as keyof typeof authored] ?? authored.en]),
) as unknown as Translation;

export default StandorteTranslation;
