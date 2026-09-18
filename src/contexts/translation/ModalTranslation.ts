import type { Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// fr/es/pt/it/nl/pl/ru/ja/zh-Hans are first-pass AI translation (ADR-009),
// pending native-speaker review.
const ModalTranslation: Translation = {
  en: {
    'setup-pin-modal.title': 'Setup App PIN',
    'setup-pin-modal.message': 'Choose a 4-digit security code to protect your app.',
    'setup-pin-modal.label-new': 'New PIN',
    'setup-pin-modal.label-repeat': 'Repeat PIN',
    'setup-pin-modal.error-mismatch': 'PINs do not match',
    'setup-pin-modal.button-save': 'Save',
    'setup-pin-modal.button-cancel': 'Cancel',

    'remove-pin-modal.title': 'Disable App Lock',
    'remove-pin-modal.message': 'Please enter your PIN to disable the lock.',
  },
  de: {
    'setup-pin-modal.title': 'App-PIN einrichten',
    'setup-pin-modal.message': 'Wählen Sie einen 4-stelligen Sicherheitscode, um Ihre App zu schützen.',
    'setup-pin-modal.label-new': 'Neue PIN',
    'setup-pin-modal.label-repeat': 'PIN wiederholen',
    'setup-pin-modal.error-mismatch': 'PINs stimmen nicht überein',
    'setup-pin-modal.button-save': 'Speichern',
    'setup-pin-modal.button-cancel': 'Abbrechen',

    'remove-pin-modal.title': 'App-Sperre deaktivieren',
    'remove-pin-modal.message': 'Bitte gib deine PIN ein, um die Sperre aufzuheben.',
  },
  fr: {
    'setup-pin-modal.title': 'Configurer le code PIN',
    'setup-pin-modal.message': "Choisissez un code de sécurité à 4 chiffres pour protéger votre application.",
    'setup-pin-modal.label-new': 'Nouveau code PIN',
    'setup-pin-modal.label-repeat': 'Répéter le code PIN',
    'setup-pin-modal.error-mismatch': 'Les codes PIN ne correspondent pas',
    'setup-pin-modal.button-save': 'Enregistrer',
    'setup-pin-modal.button-cancel': 'Annuler',

    'remove-pin-modal.title': "Désactiver le verrouillage de l'application",
    'remove-pin-modal.message': 'Veuillez saisir votre code PIN pour désactiver le verrouillage.',
  },
  es: {
    'setup-pin-modal.title': 'Configurar PIN de la app',
    'setup-pin-modal.message': 'Elige un código de seguridad de 4 dígitos para proteger tu aplicación.',
    'setup-pin-modal.label-new': 'Nuevo PIN',
    'setup-pin-modal.label-repeat': 'Repetir PIN',
    'setup-pin-modal.error-mismatch': 'Los PIN no coinciden',
    'setup-pin-modal.button-save': 'Guardar',
    'setup-pin-modal.button-cancel': 'Cancelar',

    'remove-pin-modal.title': 'Desactivar bloqueo de la app',
    'remove-pin-modal.message': 'Introduce tu PIN para desactivar el bloqueo.',
  },
  pt: {
    'setup-pin-modal.title': 'Configurar PIN do app',
    'setup-pin-modal.message': 'Escolha um código de segurança de 4 dígitos para proteger seu aplicativo.',
    'setup-pin-modal.label-new': 'Novo PIN',
    'setup-pin-modal.label-repeat': 'Repetir PIN',
    'setup-pin-modal.error-mismatch': 'Os PINs não coincidem',
    'setup-pin-modal.button-save': 'Salvar',
    'setup-pin-modal.button-cancel': 'Cancelar',

    'remove-pin-modal.title': 'Desativar bloqueio do app',
    'remove-pin-modal.message': 'Digite seu PIN para desativar o bloqueio.',
  },
  it: {
    'setup-pin-modal.title': 'Configura PIN app',
    'setup-pin-modal.message': "Scegli un codice di sicurezza a 4 cifre per proteggere la tua app.",
    'setup-pin-modal.label-new': 'Nuovo PIN',
    'setup-pin-modal.label-repeat': 'Ripeti PIN',
    'setup-pin-modal.error-mismatch': 'I PIN non corrispondono',
    'setup-pin-modal.button-save': 'Salva',
    'setup-pin-modal.button-cancel': 'Annulla',

    'remove-pin-modal.title': 'Disattiva blocco app',
    'remove-pin-modal.message': 'Inserisci il tuo PIN per disattivare il blocco.',
  },
  nl: {
    'setup-pin-modal.title': 'App-pincode instellen',
    'setup-pin-modal.message': 'Kies een 4-cijferige beveiligingscode om je app te beschermen.',
    'setup-pin-modal.label-new': 'Nieuwe pincode',
    'setup-pin-modal.label-repeat': 'Pincode herhalen',
    'setup-pin-modal.error-mismatch': 'Pincodes komen niet overeen',
    'setup-pin-modal.button-save': 'Opslaan',
    'setup-pin-modal.button-cancel': 'Annuleren',

    'remove-pin-modal.title': 'App-vergrendeling uitschakelen',
    'remove-pin-modal.message': 'Voer je pincode in om de vergrendeling uit te schakelen.',
  },
  pl: {
    'setup-pin-modal.title': 'Skonfiguruj PIN aplikacji',
    'setup-pin-modal.message': 'Wybierz 4-cyfrowy kod zabezpieczający, aby chronić swoją aplikację.',
    'setup-pin-modal.label-new': 'Nowy PIN',
    'setup-pin-modal.label-repeat': 'Powtórz PIN',
    'setup-pin-modal.error-mismatch': 'Kody PIN nie pasują do siebie',
    'setup-pin-modal.button-save': 'Zapisz',
    'setup-pin-modal.button-cancel': 'Anuluj',

    'remove-pin-modal.title': 'Wyłącz blokadę aplikacji',
    'remove-pin-modal.message': 'Wprowadź swój PIN, aby wyłączyć blokadę.',
  },
  ru: {
    'setup-pin-modal.title': 'Настройка PIN-кода',
    'setup-pin-modal.message': 'Выберите 4-значный код безопасности для защиты приложения.',
    'setup-pin-modal.label-new': 'Новый PIN-код',
    'setup-pin-modal.label-repeat': 'Повторите PIN-код',
    'setup-pin-modal.error-mismatch': 'PIN-коды не совпадают',
    'setup-pin-modal.button-save': 'Сохранить',
    'setup-pin-modal.button-cancel': 'Отмена',

    'remove-pin-modal.title': 'Отключить блокировку приложения',
    'remove-pin-modal.message': 'Введите PIN-код, чтобы отключить блокировку.',
  },
  ja: {
    'setup-pin-modal.title': 'アプリPINの設定',
    'setup-pin-modal.message': 'アプリを保護するための4桁のセキュリティコードを選択してください。',
    'setup-pin-modal.label-new': '新しいPIN',
    'setup-pin-modal.label-repeat': 'PINを再入力',
    'setup-pin-modal.error-mismatch': 'PINが一致しません',
    'setup-pin-modal.button-save': '保存',
    'setup-pin-modal.button-cancel': 'キャンセル',

    'remove-pin-modal.title': 'アプリロックを無効化',
    'remove-pin-modal.message': 'ロックを解除するにはPINを入力してください。',
  },
  'zh-Hans': {
    'setup-pin-modal.title': '设置应用 PIN 码',
    'setup-pin-modal.message': '选择一个 4 位安全码来保护您的应用。',
    'setup-pin-modal.label-new': '新 PIN 码',
    'setup-pin-modal.label-repeat': '重复输入 PIN 码',
    'setup-pin-modal.error-mismatch': 'PIN 码不匹配',
    'setup-pin-modal.button-save': '保存',
    'setup-pin-modal.button-cancel': '取消',

    'remove-pin-modal.title': '关闭应用锁',
    'remove-pin-modal.message': '请输入 PIN 码以关闭锁定。',
  },
};

export default ModalTranslation;
