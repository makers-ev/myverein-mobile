import { useNavigation, useRoute } from '@react-navigation/native';

import { useAuth } from '@/auth/AuthProvider';

/**
 * Gates a single action rather than a whole screen (`RequireAuth` is for
 * that) -- the "browse freely, log in only when you try to do X" pattern.
 * A public screen calls `requireAuth(() => doTheThing())` from a button's
 * `onPress`; signed-in users run the action immediately, guests are sent to
 * Login with `returnTo` set to the current route so they land back here.
 */
export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute();

  function requireAuth(action: () => void) {
    if (isAuthenticated) {
      action();
      return;
    }
    navigation.navigate('Login', { returnTo: route.name });
  }

  return { requireAuth, isAuthenticated };
}
