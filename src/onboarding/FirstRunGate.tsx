import React, { useEffect, useState } from 'react';

import AcceptTosModal from '@/legal/AcceptTosModal';
import { hasAcceptedTos, setTosAccepted } from '@/legal/tosAcceptanceStorage';
import IntroModal from '@/onboarding/IntroModal';
import { hasSeenIntro, setIntroSeen } from '@/onboarding/introSeenStorage';

/**
 * First-run dialogs (terms of service, then the three-card introduction), mounted once next to the tab bar so they show
 * on whatever screen the app opens first. Before Wave 14 they lived on the guest home screen only, so a person who
 * reinstalled the app while still signed in (the app then opens on Heute) never saw either. Never two blocking modals
 * at once: the introduction waits for the terms. Renders nothing otherwise.
 */
export default function FirstRunGate() {
  const [tosVisible, setTosVisible] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);

  const maybeShowIntro = () => {
    hasSeenIntro().then((seen) => {
      if (!seen) setIntroVisible(true);
    });
  };

  useEffect(() => {
    hasAcceptedTos().then((accepted) => {
      if (!accepted) setTosVisible(true);
      else maybeShowIntro();
    });
  }, []);

  return (
    <>
      <AcceptTosModal
        visible={tosVisible}
        onAccept={() => {
          void setTosAccepted();
          setTosVisible(false);
          maybeShowIntro();
        }}
      />
      <IntroModal
        visible={introVisible}
        onClose={() => {
          void setIntroSeen(true);
          setIntroVisible(false);
        }}
      />
    </>
  );
}
