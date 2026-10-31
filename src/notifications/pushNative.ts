import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';

import { ANDROID_CHANNELS, environmentLimit, type PushEnvironment, type PushPermission, type PushStatus } from './pushLogic';

type NotificationsModule = typeof import('expo-notifications');

function getProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export function getPushEnvironment(): PushEnvironment {
  return {
    isWeb: Platform.OS === 'web',
    isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    isDevice: Device.isDevice,
    hasProjectId: !!getProjectId(),
  };
}

export function pushEnvironmentLimit(): PushStatus | null {
  return environmentLimit(getPushEnvironment());
}

/**
 * `expo-notifications` is loaded lazily and only when the environment can use it: importing it in
 * Expo Go (Android) logs errors, and on web it has no push. `null` = graceful no-op for callers.
 */
let cached: NotificationsModule | null | undefined;
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  const env = getPushEnvironment();
  if (env.isWeb || env.isExpoGo) {
    cached = null;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  }
  return cached;
}

let handlerInstalled = false;
/** Foreground behaviour: show the notification like in the background (the tap routes the same way). */
export function installForegroundHandler(): void {
  const N = getNotifications();
  if (!N || handlerInstalled) return;
  handlerInstalled = true;
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function ensureAndroidChannels(label: (key: string) => string): Promise<void> {
  const N = getNotifications();
  if (!N || Platform.OS !== 'android') return;
  for (const channel of ANDROID_CHANNELS) {
    await N.setNotificationChannelAsync(channel.id, {
      name: label(channel.nameKey),
      importance: channel.importance === 'max' ? N.AndroidImportance.MAX : N.AndroidImportance.DEFAULT,
    });
  }
}

export async function readPermission(): Promise<PushPermission> {
  const N = getNotifications();
  if (!N) return 'undetermined';
  const result = await N.getPermissionsAsync();
  if (result.granted) return 'granted';
  return result.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PushPermission> {
  const N = getNotifications();
  if (!N) return 'undetermined';
  const result = await N.requestPermissionsAsync();
  if (result.granted) return 'granted';
  return result.canAskAgain ? 'undetermined' : 'denied';
}

/** Expo push token string, or null when it cannot be obtained. */
export async function getPushToken(): Promise<string | null> {
  const N = getNotifications();
  const projectId = getProjectId();
  if (!N || !projectId) return null;
  const { data } = await N.getExpoPushTokenAsync({ projectId });
  return data;
}
