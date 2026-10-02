import type { Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// fr/es/pt/it/nl/pl/ru/ja/zh-Hans are first-pass AI translation (ADR-009),
// pending native-speaker review.
const PageLayoutTranslation: Translation = {
  en: {
    'login.title': 'Login',
    'home.title': 'Home',
    'profile.title': 'Profile',
    'settings.title': 'Settings',

    'home.guest-heading': 'Browsing as a guest',
    'home.guest-body': 'Sign up to unlock the full app, or log in if you already have an account.',
    'home.signup-cta': 'Sign up',
    'home.login-cta': 'Log in',
    'home.signed-in-as': 'Signed in as {email}',
    'home.go-to-settings': 'Go to settings',
    'home.hero-title': 'Club life, organised.',
    'home.hero-subtitle': 'Members, calendar, locations and inventory in one place.',
    'home.feature.kalender.title': 'Calendar & meetings',
    'home.feature.kalender.body': 'Events, RSVP and scheduling based on availability.',
    'home.feature.standorte.title': 'Locations & inventory',
    'home.feature.standorte.body': 'Addresses, Wi-Fi QR codes, equipment and loans.',
    'home.feature.verein.title': 'Club & members',
    'home.feature.verein.body': 'Your clubs, roles and member profile at a glance.',

    'dashboard.next-event.title': 'Next event',
    'dashboard.next-event.empty': 'No upcoming events. Check the calendar for new dates.',
    'dashboard.next-event.error': 'Could not load events.',
    'dashboard.no-club': 'You are not in a club yet. Join one in the Club section.',
    'dashboard.board.title': 'Board shortcuts',
    'dashboard.board.members': 'Members',
    'dashboard.board.calendars': 'Calendars',
    'dashboard.board.locations': 'Locations',
    'dashboard.board.inventory': 'Inventory',
    'dashboard.title': 'Dashboard',

    'legal.fallback-notice': 'Not available in your language yet — showing English.',
  },
  de: {
    'login.title': 'Login',
    'home.title': 'Startseite',
    'profile.title': 'Profil',
    'settings.title': 'Einstellungen',

    'home.guest-heading': 'Du bist als Gast unterwegs',
    'home.guest-body': 'Registriere dich, um die volle App freizuschalten, oder logge dich ein, falls du schon einen Account hast.',
    'home.signup-cta': 'Registrieren',
    'home.login-cta': 'Login',
    'home.signed-in-as': 'Angemeldet als {email}',
    'home.go-to-settings': 'Zu den Einstellungen',
    'home.hero-title': 'Vereinsleben, organisiert.',
    'home.hero-subtitle': 'Mitglieder, Kalender, Standorte und Material an einem Ort.',
    'home.feature.kalender.title': 'Kalender & Treffen',
    'home.feature.kalender.body': 'Termine, Zusagen und Terminfindung nach Verfügbarkeit.',
    'home.feature.standorte.title': 'Standorte & Material',
    'home.feature.standorte.body': 'Adressen, WLAN-QR-Codes, Ausrüstung und Ausleihe.',
    'home.feature.verein.title': 'Verein & Mitglieder',
    'home.feature.verein.body': 'Deine Vereine, Rollen und dein Mitgliedsprofil im Blick.',

    'dashboard.next-event.title': 'Nächster Termin',
    'dashboard.next-event.empty': 'Keine anstehenden Termine. Schau im Kalender nach neuen Terminen.',
    'dashboard.next-event.error': 'Termine konnten nicht geladen werden.',
    'dashboard.no-club': 'Du bist noch in keinem Verein. Tritt im Bereich Verein einem bei.',
    'dashboard.board.title': 'Vorstand-Kürzel',
    'dashboard.board.members': 'Mitglieder',
    'dashboard.board.calendars': 'Kalender',
    'dashboard.board.locations': 'Standorte',
    'dashboard.board.inventory': 'Material',
    'dashboard.title': 'Dashboard',

    'legal.fallback-notice': 'Noch nicht in deiner Sprache verfügbar — zeigt Englisch.',
  },
  fr: {
    'login.title': 'Connexion',
    'home.title': 'Accueil',
    'profile.title': 'Profil',
    'settings.title': 'Paramètres',

    'home.guest-heading': 'Navigation en tant qu\'invité',
    'home.guest-body': "Inscrivez-vous pour débloquer l'application complète, ou connectez-vous si vous avez déjà un compte.",
    'home.signup-cta': "S'inscrire",
    'home.login-cta': 'Se connecter',
    'home.signed-in-as': 'Connecté en tant que {email}',
    'home.go-to-settings': 'Aller aux paramètres',

    'dashboard.title': 'Tableau de bord',

    'legal.fallback-notice': "Pas encore disponible dans votre langue — affichage en anglais.",
  },
  es: {
    'login.title': 'Iniciar sesión',
    'home.title': 'Inicio',
    'profile.title': 'Perfil',
    'settings.title': 'Ajustes',

    'home.guest-heading': 'Navegando como invitado',
    'home.guest-body': 'Regístrate para desbloquear la app completa, o inicia sesión si ya tienes una cuenta.',
    'home.signup-cta': 'Registrarse',
    'home.login-cta': 'Iniciar sesión',
    'home.signed-in-as': 'Sesión iniciada como {email}',
    'home.go-to-settings': 'Ir a ajustes',

    'dashboard.title': 'Panel',

    'legal.fallback-notice': 'Aún no disponible en tu idioma — mostrando inglés.',
  },
  pt: {
    'login.title': 'Entrar',
    'home.title': 'Início',
    'profile.title': 'Perfil',
    'settings.title': 'Configurações',

    'home.guest-heading': 'Navegando como visitante',
    'home.guest-body': 'Cadastre-se para desbloquear o app completo, ou entre se já tiver uma conta.',
    'home.signup-cta': 'Cadastrar-se',
    'home.login-cta': 'Entrar',
    'home.signed-in-as': 'Conectado como {email}',
    'home.go-to-settings': 'Ir para configurações',

    'dashboard.title': 'Painel',

    'legal.fallback-notice': 'Ainda não disponível no seu idioma — exibindo em inglês.',
  },
  it: {
    'login.title': 'Accedi',
    'home.title': 'Home',
    'profile.title': 'Profilo',
    'settings.title': 'Impostazioni',

    'home.guest-heading': 'Navigazione come ospite',
    'home.guest-body': "Registrati per sbloccare l'app completa, oppure accedi se hai già un account.",
    'home.signup-cta': 'Registrati',
    'home.login-cta': 'Accedi',
    'home.signed-in-as': 'Accesso effettuato come {email}',
    'home.go-to-settings': 'Vai alle impostazioni',

    'dashboard.title': 'Dashboard',

    'legal.fallback-notice': 'Non ancora disponibile nella tua lingua — visualizzazione in inglese.',
  },
  nl: {
    'login.title': 'Inloggen',
    'home.title': 'Home',
    'profile.title': 'Profiel',
    'settings.title': 'Instellingen',

    'home.guest-heading': 'Bladeren als gast',
    'home.guest-body': 'Registreer je om de volledige app te ontgrendelen, of log in als je al een account hebt.',
    'home.signup-cta': 'Registreren',
    'home.login-cta': 'Inloggen',
    'home.signed-in-as': 'Ingelogd als {email}',
    'home.go-to-settings': 'Naar instellingen',

    'dashboard.title': 'Dashboard',

    'legal.fallback-notice': 'Nog niet beschikbaar in jouw taal — Engels wordt getoond.',
  },
  pl: {
    'login.title': 'Logowanie',
    'home.title': 'Strona główna',
    'profile.title': 'Profil',
    'settings.title': 'Ustawienia',

    'home.guest-heading': 'Przeglądasz jako gość',
    'home.guest-body': 'Zarejestruj się, aby odblokować pełną aplikację, lub zaloguj się, jeśli masz już konto.',
    'home.signup-cta': 'Zarejestruj się',
    'home.login-cta': 'Zaloguj się',
    'home.signed-in-as': 'Zalogowano jako {email}',
    'home.go-to-settings': 'Przejdź do ustawień',

    'dashboard.title': 'Panel',

    'legal.fallback-notice': 'Niedostępne jeszcze w Twoim języku — wyświetlono wersję angielską.',
  },
  ru: {
    'login.title': 'Вход',
    'home.title': 'Главная',
    'profile.title': 'Профиль',
    'settings.title': 'Настройки',

    'home.guest-heading': 'Просмотр в гостевом режиме',
    'home.guest-body': 'Зарегистрируйтесь, чтобы разблокировать приложение полностью, или войдите, если у вас уже есть аккаунт.',
    'home.signup-cta': 'Зарегистрироваться',
    'home.login-cta': 'Войти',
    'home.signed-in-as': 'Вы вошли как {email}',
    'home.go-to-settings': 'Перейти к настройкам',

    'dashboard.title': 'Панель управления',

    'legal.fallback-notice': 'Пока недоступно на вашем языке — показан английский текст.',
  },
  ja: {
    'login.title': 'ログイン',
    'home.title': 'ホーム',
    'profile.title': 'プロフィール',
    'settings.title': '設定',

    'home.guest-heading': 'ゲストとして閲覧中',
    'home.guest-body': 'アプリの全機能を使うには登録してください。すでにアカウントをお持ちの場合はログインしてください。',
    'home.signup-cta': '新規登録',
    'home.login-cta': 'ログイン',
    'home.signed-in-as': '{email} としてログイン中',
    'home.go-to-settings': '設定へ',

    'dashboard.title': 'ダッシュボード',

    'legal.fallback-notice': 'まだお使いの言語には対応していません — 英語で表示しています。',
  },
  'zh-Hans': {
    'login.title': '登录',
    'home.title': '首页',
    'profile.title': '个人资料',
    'settings.title': '设置',

    'home.guest-heading': '正在以访客身份浏览',
    'home.guest-body': '注册以解锁完整应用，或者如果您已有账户，请登录。',
    'home.signup-cta': '注册',
    'home.login-cta': '登录',
    'home.signed-in-as': '已登录：{email}',
    'home.go-to-settings': '前往设置',

    'dashboard.title': '仪表盘',

    'legal.fallback-notice': '暂不支持您的语言 —— 正在显示英文内容。',
  },
};

export default PageLayoutTranslation;
