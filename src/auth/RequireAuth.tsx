import React, { ReactNode, useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  children: ReactNode;
  /** Rendered instead of `children` for a guest; defaults to a sign-in prompt, never a blank screen. */
  fallback?: ReactNode;
}

/**
 * Mobile equivalent of the website's `(protected)/layout.tsx`: gates an
 * entire screen behind a real session instead of leaving it reachable and
 * decorative. The website re-checks on the server because it has no
 * client-side session store of its own; this app's single source of truth
 * is `useAuth()`, so the check is just that.
 *
 * A guest is sent to Login once, when the screen first gets focus, with `returnTo` set to the current route. If they
 * come back without signing in (back button, tab), the screen stays mounted and shows a sign-in prompt with a button,
 * so they never land on a blank screen and are not pushed to Login again in a loop. See `useRequireAuth` and the
 * "## Guest mode" section of CLAUDE.md.
 */
export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const redirected = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated && !redirected.current) {
        redirected.current = true;
        navigation.navigate('Login', { returnTo: route.name });
      }
    }, [isAuthenticated, navigation, route.name]),
  );

  if (!isAuthenticated) {
    return (
      <>
        {fallback ?? (
          <EmptyState
            title={t('auth.required.title')}
            hint={t('auth.required.body')}
            action={<Button label={t('auth.required.action')} onPress={() => navigation.navigate('Login', { returnTo: route.name })} />}
          />
        )}
      </>
    );
  }

  return <>{children}</>;
}
