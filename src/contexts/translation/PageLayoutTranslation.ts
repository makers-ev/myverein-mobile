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
    'home.features-heading': 'Feature preview',

    'dashboard.title': 'Dashboard',
    'dashboard.signed-in-as': 'Signed in as {email}',
    'dashboard.placeholder-title': 'Your dashboard lives here',
    'dashboard.placeholder-body': 'Replace this screen with your app’s real authenticated landing experience.',

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
    'home.features-heading': 'Feature-Vorschau',

    'dashboard.title': 'Dashboard',
    'dashboard.signed-in-as': 'Angemeldet als {email}',
    'dashboard.placeholder-title': 'Hier lebt dein Dashboard',
    'dashboard.placeholder-body': 'Ersetze diesen Screen durch das echte, eingeloggte Startscreen-Erlebnis deiner App.',

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
    'home.features-heading': 'Aperçu des fonctionnalités',

    'dashboard.title': 'Tableau de bord',
    'dashboard.signed-in-as': 'Connecté en tant que {email}',
    'dashboard.placeholder-title': 'Votre tableau de bord se trouve ici',
    'dashboard.placeholder-body': "Remplacez cet écran par la véritable page d'accueil authentifiée de votre application.",

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
    'home.features-heading': 'Vista previa de funciones',

    'dashboard.title': 'Panel',
    'dashboard.signed-in-as': 'Sesión iniciada como {email}',
    'dashboard.placeholder-title': 'Tu panel vive aquí',
    'dashboard.placeholder-body': 'Reemplaza esta pantalla con la experiencia real de inicio autenticada de tu app.',

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
    'home.features-heading': 'Prévia de recursos',

    'dashboard.title': 'Painel',
    'dashboard.signed-in-as': 'Conectado como {email}',
    'dashboard.placeholder-title': 'Seu painel vive aqui',
    'dashboard.placeholder-body': 'Substitua esta tela pela experiência real de início autenticado do seu app.',

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
    'home.features-heading': 'Anteprima funzionalità',

    'dashboard.title': 'Dashboard',
    'dashboard.signed-in-as': 'Accesso effettuato come {email}',
    'dashboard.placeholder-title': 'La tua dashboard vive qui',
    'dashboard.placeholder-body': "Sostituisci questa schermata con la vera esperienza di accesso autenticato della tua app.",

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
    'home.features-heading': 'Functieoverzicht',

    'dashboard.title': 'Dashboard',
    'dashboard.signed-in-as': 'Ingelogd als {email}',
    'dashboard.placeholder-title': 'Hier komt je dashboard',
    'dashboard.placeholder-body': 'Vervang dit scherm door de echte, ingelogde startervaring van je app.',

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
    'home.features-heading': 'Podgląd funkcji',

    'dashboard.title': 'Panel',
    'dashboard.signed-in-as': 'Zalogowano jako {email}',
    'dashboard.placeholder-title': 'Tutaj znajduje się Twój panel',
    'dashboard.placeholder-body': 'Zastąp ten ekran prawdziwym, zalogowanym ekranem startowym Twojej aplikacji.',

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
    'home.features-heading': 'Обзор возможностей',

    'dashboard.title': 'Панель управления',
    'dashboard.signed-in-as': 'Вы вошли как {email}',
    'dashboard.placeholder-title': 'Здесь будет ваша панель управления',
    'dashboard.placeholder-body': 'Замените этот экран на настоящий стартовый экран авторизованного пользователя вашего приложения.',

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
    'home.features-heading': '機能プレビュー',

    'dashboard.title': 'ダッシュボード',
    'dashboard.signed-in-as': '{email} としてログイン中',
    'dashboard.placeholder-title': 'ここにダッシュボードが表示されます',
    'dashboard.placeholder-body': 'この画面をアプリの実際のログイン後ホーム画面に置き換えてください。',

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
    'home.features-heading': '功能预览',

    'dashboard.title': '仪表盘',
    'dashboard.signed-in-as': '已登录：{email}',
    'dashboard.placeholder-title': '您的仪表盘在这里',
    'dashboard.placeholder-body': '请将此屏幕替换为应用真正的已登录首页体验。',

    'legal.fallback-notice': '暂不支持您的语言 —— 正在显示英文内容。',
  },
};

export default PageLayoutTranslation;
