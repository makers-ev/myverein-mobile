import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { parseStoredRegistration, type StoredRegistration } from './pushLogic';

// The token + account of this install's last backend registration. Kept in the keychain/keystore
// (not a secret credential, but it ties a device to an account) so logout after a relaunch can
// still unregister it. Never logged.
const REGISTRATION_KEY = '_template_better-auth-mobile.push-registration';
// UI flag: the one-time "enable push?" hint on Mitteilungen was dismissed.
const PROMPT_DISMISSED_KEY = '_template_better-auth-mobile.push-prompt-dismissed';

export async function getStoredRegistration(): Promise<StoredRegistration | null> {
  return parseStoredRegistration(await SecureStore.getItemAsync(REGISTRATION_KEY));
}

export async function setStoredRegistration(value: StoredRegistration): Promise<void> {
  await SecureStore.setItemAsync(REGISTRATION_KEY, JSON.stringify(value));
}

export async function clearStoredRegistration(): Promise<void> {
  await SecureStore.deleteItemAsync(REGISTRATION_KEY);
}

export async function isPushPromptDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem(PROMPT_DISMISSED_KEY)) === '1';
}

export async function setPushPromptDismissed(): Promise<void> {
  await AsyncStorage.setItem(PROMPT_DISMISSED_KEY, '1');
}
