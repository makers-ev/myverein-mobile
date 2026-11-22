import { useEffect } from 'react';

import { goToTab, navigationRef } from '@/navigation/navigationRef';
import { EXTERNAL_HOME, externalRoutes } from '@/navigation/tabs';
import { useExternalAccess } from './ExternalAccessProvider';

/**
 * Keeps an external login (sponsor / service provider, Wave 15 M1) inside the reduced app, also while its role is still unknown (fail closed): whenever the current screen is
 * not one the role may open (`externalRoutes`: its own start screen, Mehr, Settings, Notifications, legal pages), for
 * example the member dashboard after sign-in, a push link or a stale back stack, it moves to the role's start screen.
 * The server refuses those club routes anyway (`403 external_role_restricted`); this only avoids showing error screens.
 * Renders nothing.
 */
export default function ExternalStartRedirect() {
  const { role, roles, reduced } = useExternalAccess();
  const rolesKey = roles.join(',');

  useEffect(() => {
    if (!reduced) return undefined;
    const allowed = externalRoutes(rolesKey ? (rolesKey.split(',') as typeof roles) : []) as readonly string[];
    const check = () => {
      if (!navigationRef.isReady()) return;
      const current = navigationRef.getCurrentRoute()?.name;
      if (current && !allowed.includes(current)) goToTab(EXTERNAL_HOME[role ?? 'sponsor']);
    };
    check();
    return navigationRef.addListener('state', check);
  }, [reduced, role, rolesKey]);

  return null;
}
