import { useEffect, useRef } from 'react';

import { navigationRef } from '@/navigation/navigationRef';
import { useWards } from '@/hooks/useWards';

const CLUB_START_ROUTES = ['Home', 'Dashboard'];

/**
 * Start routing for guardian-only accounts: no club, only wards. They land on "Heute" instead of the club dashboard
 * (or the guest home after login). Once per activation, and only from a start screen, so it never pulls the user away
 * from Settings or Notifications. Renders nothing.
 */
export default function GuardianStartRedirect() {
  const { guardianOnly } = useWards();
  const done = useRef(false);

  useEffect(() => {
    if (!guardianOnly) {
      done.current = false;
      return;
    }
    const tryRedirect = () => {
      if (done.current || !navigationRef.isReady()) return;
      const current = navigationRef.getCurrentRoute()?.name;
      if (current && CLUB_START_ROUTES.includes(current)) {
        done.current = true;
        navigationRef.navigate('Heute');
      }
    };
    tryRedirect();
    // Login navigates to Home slightly after the wards arrive: keep trying until the first start screen is hit.
    return navigationRef.addListener('state', tryRedirect);
  }, [guardianOnly]);

  return null;
}
