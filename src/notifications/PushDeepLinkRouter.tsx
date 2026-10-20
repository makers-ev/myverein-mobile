import { useEffect } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { navigationRef } from '@/navigation/navigationRef';
import { decidePushNavigation } from './pushLogic';
import { markPushTargetRouted, useIncomingPushTarget, useNavigationReady } from './pushTargetStore';

/**
 * Turns a tapped push into navigation (M3) via `navigationRef`: signed in -> the destination screen
 * (which then opens the announcement/event and shows a friendly notice when it is gone); signed
 * out -> `Login` with `returnTo`, the target waits and is routed after sign-in. Waits for the
 * navigator and the session bootstrap (cold start). Renders nothing.
 */
export default function PushDeepLinkRouter() {
  const incoming = useIncomingPushTarget();
  const navigationReady = useNavigationReady();
  const { isAuthenticated, isLoading, twoFactorPending } = useAuth();

  useEffect(() => {
    if (!incoming || !navigationRef.isReady()) return;
    const decision = decidePushNavigation(incoming, { navigationReady, authLoading: isLoading, twoFactorPending, isAuthenticated });
    if (decision.action === 'wait') return;
    if (decision.action === 'login') {
      if (navigationRef.getCurrentRoute()?.name !== 'Login') navigationRef.navigate('Login', { returnTo: decision.returnTo });
      return;
    }
    navigationRef.navigate(decision.route);
    markPushTargetRouted();
  }, [incoming, navigationReady, isLoading, twoFactorPending, isAuthenticated]);

  return null;
}
