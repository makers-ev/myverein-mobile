import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthProvider';
import { checkBackendHealth } from '@/auth/auth-client';
import { RequireAuth } from '@/auth/RequireAuth';
import ConnectionErrorScreen, { type ConnectionStatus } from '@/components/ConnectionErrorScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import EmailVerificationScreen from '@/screens/EmailVerificationScreen';
import ForgotPasswordScreen from '@/screens/ForgotPasswordScreen';
import HomeScreen from '@/screens/HomeScreen';
import LoginScreen from '@/screens/LoginScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import SignupScreen from '@/screens/SignupScreen';
import TwoFactorScreen from '@/screens/TwoFactorScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import VereinScreen from '@/screens/VereinScreen';
import KalenderScreen from '@/screens/KalenderScreen';
import StandorteScreen from '@/screens/StandorteScreen';
import JoinClubScreen from '@/screens/JoinClubScreen';
import AppLockGate from '@/components/AppLock/AppLockGate';
import Navbar from '@/components/Navbar';
import PrivacyPolicyScreen from '@/legal/PrivacyPolicyScreen';
import ImprintScreen from '@/legal/ImprintScreen';
import TermsOfServiceScreen from '@/legal/TermsOfServiceScreen';
import { useThemeColors, useNavigationTheme } from '@/theme/colors';
import { navigationRef } from './navigationRef';

/**
 * "Browse first" model (see "## Guest mode" in CLAUDE.md): still one stack,
 * with Login/Signup reachable from Home and Settings gated behind
 * `RequireAuth` rather than splitting into a fully-public vs.
 * fully-authenticated navigator. The only auth-based branch is the initial
 * route itself (see `MainNavigator`'s `initialRouteName`): guests land on
 * Home, already-authenticated users skip straight to Dashboard. `Login`
 * takes an optional `returnTo` route name so `RequireAuth`/`useRequireAuth`
 * can send guests back to whatever they were trying to reach.
 */
export type RootStackParamList = {
  Home: undefined;
  Dashboard: undefined;
  Verein: undefined;
  Kalender: undefined;
  Standorte: undefined;
  JoinClub: undefined;
  Notifications: undefined;
  Login: { returnTo?: keyof RootStackParamList } | undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  EmailVerification: { email: string };
  TwoFactor: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
  Imprint: undefined;
  TermsOfService: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainNavigator() {
  const {
    signIn,
    signUp,
    signOut,
    deleteAccount,
    resendVerificationEmail,
    requestPasswordReset,
    isAuthenticated,
  } = useAuth();
  const themeColors = useThemeColors();

  return (
    // Navbar sits here, outside the Navigator's own screens, so it stays
    // mounted across every route below without being wired into five
    // separate `header` options -- deliberately not shown for
    // TwoFactorNavigator (see AppNavigator's own comment on that).
    <View style={{ flex: 1 }}>
      <Navbar />
      {/* native-stack defaults contentStyle to white; needed for the
          Android system bars, see App.tsx's StatusBar/NavigationBar. */}
      <RootStack.Navigator
        // Already-authenticated users skip the guest-first Home screen and
        // land straight on Dashboard; guests still see Home first.
        initialRouteName={isAuthenticated ? 'Dashboard' : 'Home'}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.background } }}
      >
      <RootStack.Screen name="Home" component={HomeScreen} />
      <RootStack.Screen name="Dashboard" component={DashboardScreen} />

      <RootStack.Screen name="Verein">
        {() => (
          <RequireAuth>
            <VereinScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Kalender">
        {() => (
          <RequireAuth>
            <KalenderScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Standorte">
        {() => (
          <RequireAuth>
            <StandorteScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="JoinClub">
        {(props) => (
          <RequireAuth>
            <JoinClubScreen {...props} />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Notifications">
        {() => (
          <RequireAuth>
            <NotificationsScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Login">
        {({ navigation, route }) => (
          <LoginScreen
            onLogin={async (email, password) => {
              const result = await signIn(email, password);
              // No-op when `signIn` instead flipped `twoFactorPending` --
              // AppNavigator below swaps this whole navigator out for
              // TwoFactorNavigator in that case, so there's nowhere here to
              // navigate to yet.
              if (result.success) {
                navigation.navigate(route.params?.returnTo ?? 'Home');
              }
              return result;
            }}
            onNavigateToSignup={() => navigation.navigate('Signup')}
            onForgotPassword={() => navigation.navigate('ForgotPassword')}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="ForgotPassword">
        {({ navigation }) => (
          <ForgotPasswordScreen
            onSubmit={(email) => requestPasswordReset(email)}
            onBackToLogin={() => navigation.navigate('Login')}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Signup">
        {({ navigation }) => (
          <SignupScreen
            onSubmit={async (formData) => {
              const name = [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim();
              if (!formData.email || !formData.password) {
                return { success: false, error: 'Email and password are required.' };
              }
              const result = await signUp({
                email: formData.email,
                password: formData.password,
                name: name || formData.email,
              });
              if (result.success) {
                navigation.navigate('EmailVerification', { email: formData.email });
              }
              return result;
            }}
            onNavigateToLogin={() => navigation.navigate('Login')}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="EmailVerification">
        {({ navigation, route }) => (
          <EmailVerificationScreen
            email={route.params.email}
            onResend={() => resendVerificationEmail(route.params.email)}
            onBackToLogin={() => navigation.navigate('Login')}
          />
        )}
      </RootStack.Screen>

      {/* Not gated -- Settings now has plenty guests actually want
          (language, theme, App Lock, legal). Only the sections inside that
          need a real session (Profile/Security/Sessions) branch on
          isAuthenticated themselves; see SettingsScreen.tsx. */}
      <RootStack.Screen name="Settings">
        {({ navigation }) => (
          <SettingsScreen
            onLogout={() => void signOut()}
            onDeleteAccount={async (password) => {
              const result = await deleteAccount(password);
              if (result.success) {
                navigation.navigate('Home');
              }
              return result;
            }}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <RootStack.Screen name="Imprint" component={ImprintScreen} />
      <RootStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      </RootStack.Navigator>
    </View>
  );
}

function TwoFactorNavigator() {
  const { verifyTwoFactor, cancelTwoFactor } = useAuth();
  const themeColors = useThemeColors();

  // 2FA is a step in the login flow, not a separate route users can
  // navigate to directly -- gate it on auth state rather than wiring a
  // `navigation.navigate('TwoFactor')` call from inside LoginScreen.
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.background } }}>
      <RootStack.Screen name="TwoFactor">
        {() => <TwoFactorScreen onVerify={verifyTwoFactor} onCancel={cancelTwoFactor} />}
      </RootStack.Screen>
    </RootStack.Navigator>
  );
}

// How long the initial session bootstrap gets before we stop spinning and
// assume the backend is unreachable.
const BOOTSTRAP_TIMEOUT_MS = 9000;

export default function AppNavigator() {
  const { isLoading, twoFactorPending, refetchSession } = useAuth();
  const themeColors = useThemeColors();
  const navigationTheme = useNavigationTheme();

  // `isLoading` flips true again on background session refetches too (e.g.
  // after signup/delete), not just the initial load -- gating the whole
  // navigator on it would unmount and reset it to `initialRouteName` every
  // time. Only the first load should do that.
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  useEffect(() => {
    if (!isLoading) setHasBootstrapped(true);
  }, [isLoading]);

  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    if (hasBootstrapped) {
      setConnectionTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setConnectionTimedOut(true), BOOTSTRAP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasBootstrapped]);

  const handleRetryConnection = async () => {
    setConnectionStatus('checking');
    const reachable = await checkBackendHealth();
    setConnectionStatus(reachable ? 'online' : 'offline');
    if (reachable) {
      setConnectionTimedOut(false);
      await refetchSession();
    }
  };

  if (isLoading && !hasBootstrapped) {
    if (connectionTimedOut) {
      return <ConnectionErrorScreen status={connectionStatus} onRetry={() => void handleRetryConnection()} />;
    }
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  return (
    // AppLockGate only activates once a PIN has been set in Settings --
    // stays inert until then, for guests and signed-in users alike.
    <AppLockGate>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        {twoFactorPending ? <TwoFactorNavigator /> : <MainNavigator />}
      </NavigationContainer>
    </AppLockGate>
  );
}
