import type { Language } from './supportedLanguages';

type Translation = Record<Language, Record<string, string>>;

// 'notification.welcome.*' render the system welcome notification's
// `translationKey` (see _template_better-auth-backend's databaseHooks.user.create
// hook) -- `{{appName}}` is filled in by `t()` itself (LanguageContext.tsx),
// merging its own app.json default with the notification's `paramsJson`.
// fr/es/pt/it/nl/pl/ru/ja/zh-Hans are first-pass AI translation (ADR-009),
// pending native-speaker review.
const NotificationTranslation: Translation = {
  en: {
    'nav.notifications': 'Notifications',

    'notification.welcome.title': 'Welcome to {{appName}}!',
    'notification.welcome.body': "Glad you're here. Take a look around and set up your account in Settings.",

    'notifications.title': 'Notifications',
    'notifications.tab.unread': 'Unread',
    'notifications.tab.read': 'Read',
    'notifications.empty.unread': 'No unread notifications.',
    'notifications.empty.read': 'No read notifications.',
    'notifications.action.mark-read': 'Mark as read',
    'notifications.action.mark-unread': 'Mark as unread',
    'notifications.action.delete': 'Delete',
    'notifications.action.cancel': 'Cancel',
    'notifications.delete-confirm-title': 'Delete notification?',
    'notifications.delete-confirm-message': 'This cannot be undone.',
  },
  de: {
    'nav.notifications': 'Benachrichtigungen',

    'notification.welcome.title': 'Willkommen bei {{appName}}!',
    'notification.welcome.body': 'Schön, dass du da bist. Schau dich in Ruhe um und richte deinen Account in den Einstellungen ein.',

    'notifications.title': 'Benachrichtigungen',
    'notifications.tab.unread': 'Ungelesen',
    'notifications.tab.read': 'Gelesen',
    'notifications.empty.unread': 'Keine ungelesenen Benachrichtigungen.',
    'notifications.empty.read': 'Keine gelesenen Benachrichtigungen.',
    'notifications.action.mark-read': 'Als gelesen markieren',
    'notifications.action.mark-unread': 'Als ungelesen markieren',
    'notifications.action.delete': 'Löschen',
    'notifications.action.cancel': 'Abbrechen',
    'notifications.delete-confirm-title': 'Benachrichtigung löschen?',
    'notifications.delete-confirm-message': 'Das kann nicht rückgängig gemacht werden.',
  },
  fr: {
    'nav.notifications': 'Notifications',

    'notification.welcome.title': 'Bienvenue sur {{appName}} !',
    'notification.welcome.body': 'Ravi de vous compter parmi nous. Jetez un œil et configurez votre compte dans les paramètres.',

    'notifications.title': 'Notifications',
    'notifications.tab.unread': 'Non lues',
    'notifications.tab.read': 'Lues',
    'notifications.empty.unread': 'Aucune notification non lue.',
    'notifications.empty.read': 'Aucune notification lue.',
    'notifications.action.mark-read': 'Marquer comme lu',
    'notifications.action.mark-unread': 'Marquer comme non lu',
    'notifications.action.delete': 'Supprimer',
    'notifications.action.cancel': 'Annuler',
    'notifications.delete-confirm-title': 'Supprimer la notification ?',
    'notifications.delete-confirm-message': 'Cette action est irréversible.',
  },
  es: {
    'nav.notifications': 'Notificaciones',

    'notification.welcome.title': '¡Bienvenido a {{appName}}!',
    'notification.welcome.body': 'Nos alegra tenerte aquí. Échale un vistazo y configura tu cuenta en Ajustes.',

    'notifications.title': 'Notificaciones',
    'notifications.tab.unread': 'No leídas',
    'notifications.tab.read': 'Leídas',
    'notifications.empty.unread': 'No hay notificaciones sin leer.',
    'notifications.empty.read': 'No hay notificaciones leídas.',
    'notifications.action.mark-read': 'Marcar como leída',
    'notifications.action.mark-unread': 'Marcar como no leída',
    'notifications.action.delete': 'Eliminar',
    'notifications.action.cancel': 'Cancelar',
    'notifications.delete-confirm-title': '¿Eliminar notificación?',
    'notifications.delete-confirm-message': 'Esta acción no se puede deshacer.',
  },
  pt: {
    'nav.notifications': 'Notificações',

    'notification.welcome.title': 'Bem-vindo ao {{appName}}!',
    'notification.welcome.body': 'Que bom te ver por aqui. Dê uma olhada e configure sua conta em Configurações.',

    'notifications.title': 'Notificações',
    'notifications.tab.unread': 'Não lidas',
    'notifications.tab.read': 'Lidas',
    'notifications.empty.unread': 'Nenhuma notificação não lida.',
    'notifications.empty.read': 'Nenhuma notificação lida.',
    'notifications.action.mark-read': 'Marcar como lida',
    'notifications.action.mark-unread': 'Marcar como não lida',
    'notifications.action.delete': 'Excluir',
    'notifications.action.cancel': 'Cancelar',
    'notifications.delete-confirm-title': 'Excluir notificação?',
    'notifications.delete-confirm-message': 'Esta ação não pode ser desfeita.',
  },
  it: {
    'nav.notifications': 'Notifiche',

    'notification.welcome.title': 'Benvenuto su {{appName}}!',
    'notification.welcome.body': 'Siamo felici di averti qui. Dai un\'occhiata e configura il tuo account in Impostazioni.',

    'notifications.title': 'Notifiche',
    'notifications.tab.unread': 'Non lette',
    'notifications.tab.read': 'Lette',
    'notifications.empty.unread': 'Nessuna notifica non letta.',
    'notifications.empty.read': 'Nessuna notifica letta.',
    'notifications.action.mark-read': 'Segna come letta',
    'notifications.action.mark-unread': 'Segna come non letta',
    'notifications.action.delete': 'Elimina',
    'notifications.action.cancel': 'Annulla',
    'notifications.delete-confirm-title': 'Eliminare la notifica?',
    'notifications.delete-confirm-message': 'Questa azione non può essere annullata.',
  },
  nl: {
    'nav.notifications': 'Meldingen',

    'notification.welcome.title': 'Welkom bij {{appName}}!',
    'notification.welcome.body': 'Fijn dat je er bent. Kijk gerust rond en stel je account in bij Instellingen.',

    'notifications.title': 'Meldingen',
    'notifications.tab.unread': 'Ongelezen',
    'notifications.tab.read': 'Gelezen',
    'notifications.empty.unread': 'Geen ongelezen meldingen.',
    'notifications.empty.read': 'Geen gelezen meldingen.',
    'notifications.action.mark-read': 'Als gelezen markeren',
    'notifications.action.mark-unread': 'Als ongelezen markeren',
    'notifications.action.delete': 'Verwijderen',
    'notifications.action.cancel': 'Annuleren',
    'notifications.delete-confirm-title': 'Melding verwijderen?',
    'notifications.delete-confirm-message': 'Dit kan niet ongedaan worden gemaakt.',
  },
  pl: {
    'nav.notifications': 'Powiadomienia',

    'notification.welcome.title': 'Witamy w {{appName}}!',
    'notification.welcome.body': 'Cieszymy się, że tu jesteś. Rozejrzyj się i skonfiguruj swoje konto w Ustawieniach.',

    'notifications.title': 'Powiadomienia',
    'notifications.tab.unread': 'Nieprzeczytane',
    'notifications.tab.read': 'Przeczytane',
    'notifications.empty.unread': 'Brak nieprzeczytanych powiadomień.',
    'notifications.empty.read': 'Brak przeczytanych powiadomień.',
    'notifications.action.mark-read': 'Oznacz jako przeczytane',
    'notifications.action.mark-unread': 'Oznacz jako nieprzeczytane',
    'notifications.action.delete': 'Usuń',
    'notifications.action.cancel': 'Anuluj',
    'notifications.delete-confirm-title': 'Usunąć powiadomienie?',
    'notifications.delete-confirm-message': 'Tej operacji nie można cofnąć.',
  },
  ru: {
    'nav.notifications': 'Уведомления',

    'notification.welcome.title': 'Добро пожаловать в {{appName}}!',
    'notification.welcome.body': 'Рады видеть вас здесь. Осмотритесь и настройте свой аккаунт в разделе «Настройки».',

    'notifications.title': 'Уведомления',
    'notifications.tab.unread': 'Непрочитанные',
    'notifications.tab.read': 'Прочитанные',
    'notifications.empty.unread': 'Нет непрочитанных уведомлений.',
    'notifications.empty.read': 'Нет прочитанных уведомлений.',
    'notifications.action.mark-read': 'Отметить как прочитанное',
    'notifications.action.mark-unread': 'Отметить как непрочитанное',
    'notifications.action.delete': 'Удалить',
    'notifications.action.cancel': 'Отмена',
    'notifications.delete-confirm-title': 'Удалить уведомление?',
    'notifications.delete-confirm-message': 'Это действие нельзя отменить.',
  },
  ja: {
    'nav.notifications': '通知',

    'notification.welcome.title': '{{appName}}へようこそ！',
    'notification.welcome.body': 'ご利用ありがとうございます。設定画面からアカウントを設定してみましょう。',

    'notifications.title': '通知',
    'notifications.tab.unread': '未読',
    'notifications.tab.read': '既読',
    'notifications.empty.unread': '未読の通知はありません。',
    'notifications.empty.read': '既読の通知はありません。',
    'notifications.action.mark-read': '既読にする',
    'notifications.action.mark-unread': '未読にする',
    'notifications.action.delete': '削除',
    'notifications.action.cancel': 'キャンセル',
    'notifications.delete-confirm-title': '通知を削除しますか？',
    'notifications.delete-confirm-message': 'この操作は取り消せません。',
  },
  'zh-Hans': {
    'nav.notifications': '通知',

    'notification.welcome.title': '欢迎使用 {{appName}}！',
    'notification.welcome.body': '很高兴你能加入。看看四周，并在设置中配置你的账户。',

    'notifications.title': '通知',
    'notifications.tab.unread': '未读',
    'notifications.tab.read': '已读',
    'notifications.empty.unread': '暂无未读通知。',
    'notifications.empty.read': '暂无已读通知。',
    'notifications.action.mark-read': '标记为已读',
    'notifications.action.mark-unread': '标记为未读',
    'notifications.action.delete': '删除',
    'notifications.action.cancel': '取消',
    'notifications.delete-confirm-title': '删除该通知？',
    'notifications.delete-confirm-message': '此操作无法撤销。',
  },
};

export default NotificationTranslation;
