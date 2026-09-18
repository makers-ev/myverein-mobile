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
    'nav.verein': 'Verein',
    'verein.no-club.title': 'Noch kein Verein',
    'verein.no-club.body': 'Du bist noch in keinem Verein Mitglied. Wende dich an deinen Vorstand, um beizutreten.',
    'verein.tab.info': 'Vereinsinfo',
    'verein.tab.mitglieder': 'Mitglieder',
    'verein.info.board': 'Vorstand',
    'verein.info.board.empty': 'Noch keine Vorstandsrollen vergeben.',
    'verein.info.departments': 'Abteilungen',
    'verein.info.departments.empty': 'Noch keine Abteilungen angelegt.',
    'verein.info.pages': 'Dokumente',
    'verein.info.pages.empty': 'Noch keine Vereinsdokumente hinterlegt.',
    'verein.members.empty': 'Keine Mitglieder gefunden.',
    'verein.members.category': 'Kategorie',
    'verein.members.joined': 'Mitglied seit',
    'verein.role.vorsitz': 'Vorsitz',
    'verein.role.stellv_vorsitz': 'Stellv. Vorsitz',
    'verein.role.kassenwart': 'Kassenwart:in',
    'verein.role.schriftfuehrer': 'Schriftführer:in',
    'verein.role.beisitzer': 'Beisitzer:in',
    'verein.role.abteilungsleitung': 'Abteilungsleitung',
    'verein.role.trainer': 'Trainer:in',
    'verein.role.erziehungsberechtigt': 'Erziehungsberechtigt',
    'verein.category.aktiv': 'Aktiv',
    'verein.category.passiv': 'Passiv',
    'verein.category.foerdernd': 'Fördernd',
    'verein.category.ehrenmitglied': 'Ehrenmitglied',
    'verein.category.jugend': 'Jugend',
  },
  en: {
    'nav.verein': 'Club',
    'verein.no-club.title': 'No club yet',
    'verein.no-club.body': "You're not a member of a club yet. Ask your club's board how to join.",
    'verein.tab.info': 'Club info',
    'verein.tab.mitglieder': 'Members',
    'verein.info.board': 'Board',
    'verein.info.board.empty': 'No board roles assigned yet.',
    'verein.info.departments': 'Departments',
    'verein.info.departments.empty': 'No departments yet.',
    'verein.info.pages': 'Documents',
    'verein.info.pages.empty': 'No club documents yet.',
    'verein.members.empty': 'No members found.',
    'verein.members.category': 'Category',
    'verein.members.joined': 'Member since',
    'verein.role.vorsitz': 'Chair',
    'verein.role.stellv_vorsitz': 'Deputy Chair',
    'verein.role.kassenwart': 'Treasurer',
    'verein.role.schriftfuehrer': 'Secretary',
    'verein.role.beisitzer': 'Assessor',
    'verein.role.abteilungsleitung': 'Department Lead',
    'verein.role.trainer': 'Trainer',
    'verein.role.erziehungsberechtigt': 'Guardian',
    'verein.category.aktiv': 'Active',
    'verein.category.passiv': 'Passive',
    'verein.category.foerdernd': 'Supporting',
    'verein.category.ehrenmitglied': 'Honorary member',
    'verein.category.jugend': 'Youth',
  },
};

const VereinTranslation: Translation = Object.fromEntries(
  supportedLanguageIds.map((id) => [id, authored[id as keyof typeof authored] ?? authored.en]),
) as unknown as Translation;

export default VereinTranslation;
