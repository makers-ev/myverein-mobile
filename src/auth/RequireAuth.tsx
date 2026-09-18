import React, { ReactNode, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  children: ReactNode;
  /** Rendered instead of `children` (and instead of nothing) while redirecting. */
  fallback?: ReactNode;
}

/**
 * Mobile equivalent of the website's `(protected)/layout.tsx`: gates an
 * entire screen behind a real session instead of leaving it reachable and
 * decorative. The website re-checks on the server because it has no
 * client-side session store of its own; this app's single source of truth
 * is `useAuth()`, so the check is just that.
 *
 * Redirects to Login with `returnTo` set to the current route name, so a
 * real product can navigate back here after a successful sign-in (this
 * template does not implement that return-navigation itself -- see
 * `useRequireAuth` and the "## Guest mode" section of CLAUDE.md).
 */
export function RequireAuth({ children, fallback = null }: RequireAuthProps) {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login', { returnTo: route.name });
    }
  }, [isAuthenticated, navigation, route.name]);

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
