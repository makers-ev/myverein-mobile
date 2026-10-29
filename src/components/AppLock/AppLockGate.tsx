import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, View } from 'react-native';

import AppLockScreen from '@/screens/AppLockScreen';
import { getAppLockPin } from '@/auth/appLockStorage';
import { useThemeColors } from '@/theme/colors';

interface AppLockGateProps {
  children: React.ReactNode;
}

/**
 * App-wide enforcement point for the Settings "App Lock" PIN feature.
 *
 * Previously the Settings screen let a user "create" a PIN that was never
 * actually checked anywhere, so the app appeared protected while being
 * fully accessible. This gate makes the PIN meaningful: on launch, and
 * every time the app returns from the background, it checks whether a PIN
 * is configured and -- if so -- blocks rendering of the app until the
 * correct PIN is entered (see AppLockScreen for the entry UI + brute-force
 * lockout).
 */
export default function AppLockGate({ children }: AppLockGateProps) {
  const themeColors = useThemeColors();
  const [isChecking, setIsChecking] = useState(true);
  const [lockPin, setLockPin] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Check on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pin = await getAppLockPin();
      if (cancelled) return;
      setLockPin(pin);
      setIsLocked(!!pin);
      setIsChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-lock whenever the app leaves the foreground, and re-read the PIN so
  // a PIN created/removed in Settings during this session takes effect the
  // next time the app is (re)entered.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const leavingForeground = wasActive && nextState !== 'active';

      if (leavingForeground) {
        void (async () => {
          const pin = await getAppLockPin();
          setLockPin(pin);
          if (pin) {
            setIsLocked(true);
          }
        })();
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  if (isChecking) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  const showLock = isLocked && !!lockPin;

  // The app stays mounted underneath (navigation state, drafts, scroll positions survive a short background trip); the
  // lock screen covers it and the covered tree is hidden from touch and screen readers.
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={showLock ? 'none' : 'auto'}
        accessibilityElementsHidden={showLock}
        importantForAccessibility={showLock ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {showLock ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 }} accessibilityViewIsModal>
          <AppLockScreen pin={lockPin} onUnlock={() => setIsLocked(false)} />
        </View>
      ) : null}
    </View>
  );
}
