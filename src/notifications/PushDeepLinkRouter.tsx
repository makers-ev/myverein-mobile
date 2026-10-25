import { useEffect } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { navigationRef } from '@/navigation/navigationRef';
import { decidePushNavigation } from './pushLogic';
import { markPushTargetRouted, setNavigationReady, useIncomingPushTarget, useNavigationReady } from './pushTargetStore';

/**
 * Turns a tapped push into navigation (M3) via `navigationRef`: signed in -> the destination screen
 * (which then opens the announcement/event and shows a friendly notice when it is gone); signed
 * out -> `Login` with `returnTo`, the target waits and is routed after sign-in. Waits for the
 * navigator and the session bootstrap (cold start), and again after the container remounts (App Lock). Renders nothing.
 */
export default function PushDeepLinkRouter() {
  const incoming = useIncomingPushTarget();
  const navigationReady = useNavigationReady();
  const { isAuthenticated, isLoading, twoFactorPending } = useAuth();

  // The container (and this router with it) unmounts while the App Lock screen is shown; resetting
  // readiness on unmount makes the next `onReady` a real false -> true edge that re-runs the routing
  // below, so a tap received while locked is not dropped after unlock.
  useEffect(() => {
    if (navigationRef.isReady()) setNavigationReady(true);
    return () => setNavigationReady(false);
  }, []);

  useEffect(() => {
    if (!incoming || !navigationRef.isReady()) return;
    const decision = decidePushNavigation(incoming, { navigationReady, authLoading: isLoading, twoFactorPending, isAuthenticated });
    if (decision.action === 'wait') return;
    if (decision.action === 'login') {
      if (navigationRef.getCurrentRoute()?.name !== 'Login') navigationRef.navigate('Login', { returnTo: decision.returnTo });
      return;
    }
    // Ballot / assembly screens take the id as a route param and handle it themselves (no consume step).
    if (incoming.kind === 'ballot') navigationRef.navigate('Abstimmungen', incoming.ballotId ? { ballotId: incoming.ballotId } : undefined);
    else if (incoming.kind === 'assembly') navigationRef.navigate('Versammlung', { meetingId: incoming.meetingId });
    else navigationRef.navigate(decision.route);
    markPushTargetRouted();
  }, [incoming, navigationReady, isLoading, twoFactorPending, isAuthenticated]);

  return null;
}
