import type { Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// fr/es/pt/it/nl/pl/ru/ja/zh-Hans are first-pass AI translation (ADR-009),
// pending native-speaker review.
const GeneralTranslation: Translation = {
  en: {
    'alert.general-error-title': 'Error',
    'alert.general-error-description': 'An unexpected error occurred. Please try again later.',

    'page.no-content-found': 'No content found.',

    'lockout.too-many-attempts': 'Too many attempts. Try again in {seconds}s.',
    'lockout.attempts-remaining': '{count} attempt(s) remaining.',

    'connection.offline-title': "Couldn't connect to the server",
    'connection.offline-description': 'Please try again later.',
    'connection.status-checking': 'Checking connection…',
    'connection.status-online': 'Connected',
    'connection.status-offline': 'Server unreachable',
    'connection.retry': 'Try again',
    'connection.status-link': 'Check server status',
    'connection.report-error-link': 'Report a problem',
  },
  de: {
    'alert.general-error-title': 'Fehler',
    'alert.general-error-description': 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.',

    'page.no-content-found': 'Keine Inhalte gefunden.',

    'lockout.too-many-attempts': 'Zu viele Versuche. Bitte versuche es in {seconds}s erneut.',
    'lockout.attempts-remaining': 'Noch {count} Versuch(e) übrig.',

    'connection.offline-title': 'Konnte keine Verbindung zum Server herstellen',
    'connection.offline-description': 'Bitte versuche es später erneut.',
    'connection.status-checking': 'Verbindung wird geprüft…',
    'connection.status-online': 'Verbunden',
    'connection.status-offline': 'Server nicht erreichbar',
    'connection.retry': 'Erneut versuchen',
    'connection.status-link': 'Serverstatus prüfen',
    'connection.report-error-link': 'Problem melden',
  },
  fr: {
    'alert.general-error-title': 'Erreur',
    'alert.general-error-description': "Une erreur inattendue s'est produite. Veuillez réessayer plus tard.",

    'page.no-content-found': 'Aucun contenu trouvé.',

    'lockout.too-many-attempts': 'Trop de tentatives. Réessayez dans {seconds}s.',
    'lockout.attempts-remaining': '{count} tentative(s) restante(s).',

    'connection.offline-title': 'Impossible de se connecter au serveur',
    'connection.offline-description': 'Veuillez réessayer plus tard.',
    'connection.status-checking': 'Vérification de la connexion…',
    'connection.status-online': 'Connecté',
    'connection.status-offline': 'Serveur inaccessible',
    'connection.retry': 'Réessayer',
    'connection.status-link': 'Vérifier le statut du serveur',
    'connection.report-error-link': 'Signaler un problème',
  },
  es: {
    'alert.general-error-title': 'Error',
    'alert.general-error-description': 'Se produjo un error inesperado. Inténtalo de nuevo más tarde.',

    'page.no-content-found': 'No se encontró contenido.',

    'lockout.too-many-attempts': 'Demasiados intentos. Vuelve a intentarlo en {seconds}s.',
    'lockout.attempts-remaining': '{count} intento(s) restante(s).',

    'connection.offline-title': 'No se pudo conectar con el servidor',
    'connection.offline-description': 'Inténtalo de nuevo más tarde.',
    'connection.status-checking': 'Comprobando conexión…',
    'connection.status-online': 'Conectado',
    'connection.status-offline': 'Servidor inaccesible',
    'connection.retry': 'Reintentar',
    'connection.status-link': 'Comprobar el estado del servidor',
    'connection.report-error-link': 'Informar de un problema',
  },
  pt: {
    'alert.general-error-title': 'Erro',
    'alert.general-error-description': 'Ocorreu um erro inesperado. Tente novamente mais tarde.',

    'page.no-content-found': 'Nenhum conteúdo encontrado.',

    'lockout.too-many-attempts': 'Muitas tentativas. Tente novamente em {seconds}s.',
    'lockout.attempts-remaining': '{count} tentativa(s) restante(s).',

    'connection.offline-title': 'Não foi possível conectar ao servidor',
    'connection.offline-description': 'Tente novamente mais tarde.',
    'connection.status-checking': 'Verificando conexão…',
    'connection.status-online': 'Conectado',
    'connection.status-offline': 'Servidor inacessível',
    'connection.retry': 'Tentar novamente',
    'connection.status-link': 'Verificar status do servidor',
    'connection.report-error-link': 'Reportar um problema',
  },
  it: {
    'alert.general-error-title': 'Errore',
    'alert.general-error-description': 'Si è verificato un errore imprevisto. Riprova più tardi.',

    'page.no-content-found': 'Nessun contenuto trovato.',

    'lockout.too-many-attempts': 'Troppi tentativi. Riprova tra {seconds}s.',
    'lockout.attempts-remaining': '{count} tentativo/i rimanente/i.',

    'connection.offline-title': 'Impossibile connettersi al server',
    'connection.offline-description': 'Riprova più tardi.',
    'connection.status-checking': 'Verifica della connessione…',
    'connection.status-online': 'Connesso',
    'connection.status-offline': 'Server non raggiungibile',
    'connection.retry': 'Riprova',
    'connection.status-link': 'Controlla lo stato del server',
    'connection.report-error-link': 'Segnala un problema',
  },
  nl: {
    'alert.general-error-title': 'Fout',
    'alert.general-error-description': 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.',

    'page.no-content-found': 'Geen inhoud gevonden.',

    'lockout.too-many-attempts': 'Te veel pogingen. Probeer het over {seconds}s opnieuw.',
    'lockout.attempts-remaining': 'Nog {count} poging(en) over.',

    'connection.offline-title': 'Kon geen verbinding maken met de server',
    'connection.offline-description': 'Probeer het later opnieuw.',
    'connection.status-checking': 'Verbinding controleren…',
    'connection.status-online': 'Verbonden',
    'connection.status-offline': 'Server niet bereikbaar',
    'connection.retry': 'Opnieuw proberen',
    'connection.status-link': 'Serverstatus controleren',
    'connection.report-error-link': 'Probleem melden',
  },
  pl: {
    'alert.general-error-title': 'Błąd',
    'alert.general-error-description': 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.',

    'page.no-content-found': 'Nie znaleziono treści.',

    'lockout.too-many-attempts': 'Zbyt wiele prób. Spróbuj ponownie za {seconds}s.',
    'lockout.attempts-remaining': 'Pozostało prób: {count}.',

    'connection.offline-title': 'Nie można połączyć się z serwerem',
    'connection.offline-description': 'Spróbuj ponownie później.',
    'connection.status-checking': 'Sprawdzanie połączenia…',
    'connection.status-online': 'Połączono',
    'connection.status-offline': 'Serwer niedostępny',
    'connection.retry': 'Spróbuj ponownie',
    'connection.status-link': 'Sprawdź stan serwera',
    'connection.report-error-link': 'Zgłoś problem',
  },
  ru: {
    'alert.general-error-title': 'Ошибка',
    'alert.general-error-description': 'Произошла непредвиденная ошибка. Повторите попытку позже.',

    'page.no-content-found': 'Содержимое не найдено.',

    'lockout.too-many-attempts': 'Слишком много попыток. Повторите через {seconds} с.',
    'lockout.attempts-remaining': 'Осталось попыток: {count}.',

    'connection.offline-title': 'Не удалось подключиться к серверу',
    'connection.offline-description': 'Повторите попытку позже.',
    'connection.status-checking': 'Проверка соединения…',
    'connection.status-online': 'Подключено',
    'connection.status-offline': 'Сервер недоступен',
    'connection.retry': 'Повторить',
    'connection.status-link': 'Проверить статус сервера',
    'connection.report-error-link': 'Сообщить о проблеме',
  },
  ja: {
    'alert.general-error-title': 'エラー',
    'alert.general-error-description': '予期しないエラーが発生しました。しばらくしてからもう一度お試しください。',

    'page.no-content-found': 'コンテンツが見つかりません。',

    'lockout.too-many-attempts': '試行回数が多すぎます。{seconds}秒後にもう一度お試しください。',
    'lockout.attempts-remaining': '残り{count}回試行できます。',

    'connection.offline-title': 'サーバーに接続できませんでした',
    'connection.offline-description': 'しばらくしてからもう一度お試しください。',
    'connection.status-checking': '接続を確認しています…',
    'connection.status-online': '接続済み',
    'connection.status-offline': 'サーバーに到達できません',
    'connection.retry': '再試行',
    'connection.status-link': 'サーバーステータスを確認',
    'connection.report-error-link': '問題を報告',
  },
  'zh-Hans': {
    'alert.general-error-title': '错误',
    'alert.general-error-description': '发生意外错误，请稍后重试。',

    'page.no-content-found': '未找到内容。',

    'lockout.too-many-attempts': '尝试次数过多，请在 {seconds} 秒后重试。',
    'lockout.attempts-remaining': '剩余 {count} 次尝试。',

    'connection.offline-title': '无法连接到服务器',
    'connection.offline-description': '请稍后重试。',
    'connection.status-checking': '正在检查连接…',
    'connection.status-online': '已连接',
    'connection.status-offline': '服务器无法访问',
    'connection.retry': '重试',
    'connection.status-link': '检查服务器状态',
    'connection.report-error-link': '报告问题',
  },
};

export default GeneralTranslation;
