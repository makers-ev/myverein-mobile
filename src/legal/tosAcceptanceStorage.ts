import AsyncStorage from '@react-native-async-storage/async-storage';

// Whether has been seen, not a secret -- AsyncStorage (already a
// dependency, unlike expo-secure-store this doesn't round-trip through the
// OS keychain for a plain UI flag) is enough here, same tool mycollection-app
// uses for the identical first-launch check.
const TOS_ACCEPTED_KEY = '_template_better-auth-mobile.tos-accepted';

export async function hasAcceptedTos(): Promise<boolean> {
  return (await AsyncStorage.getItem(TOS_ACCEPTED_KEY)) === '1';
}

export async function setTosAccepted(): Promise<void> {
  await AsyncStorage.setItem(TOS_ACCEPTED_KEY, '1');
}
