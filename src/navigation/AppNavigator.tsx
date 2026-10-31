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
import MitteilungenScreen from '@/screens/MitteilungenScreen';
import SignupScreen from '@/screens/SignupScreen';
import TwoFactorScreen from '@/screens/TwoFactorScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import VereinScreen from '@/screens/VereinScreen';
import KalenderScreen from '@/screens/KalenderScreen';
import StandorteScreen from '@/screens/StandorteScreen';
import ClubApplicationsScreen from '@/screens/ClubApplicationsScreen';
import ProfileModulesScreen from '@/screens/ProfileModulesScreen';
import HeuteScreen from '@/screens/HeuteScreen';
import MehrScreen from '@/screens/MehrScreen';
import SucheScreen from '@/screens/SucheScreen';
import PrivacyCenterScreen from '@/screens/PrivacyCenterScreen';
import AbstimmungenScreen from '@/screens/AbstimmungenScreen';
import VersammlungScreen from '@/screens/VersammlungScreen';
import MeineDokumenteScreen from '@/screens/MeineDokumenteScreen';
import ArchivScreen from '@/screens/ArchivScreen';
import BestaetigungenScreen from '@/screens/BestaetigungenScreen';
import AusweisKontrolleScreen from '@/screens/AusweisKontrolleScreen';
import MitgliedsausweisScreen from '@/screens/MitgliedsausweisScreen';
import GuardianStartRedirect from '@/guardian/GuardianStartRedirect';
import JoinClubScreen from '@/screens/JoinClubScreen';
import CreateClubScreen from '@/screens/CreateClubScreen';
import AppLockGate from '@/components/AppLock/AppLockGate';
import Navbar from '@/components/Navbar';
import PrivacyPolicyScreen from '@/legal/PrivacyPolicyScreen';
import ImprintScreen from '@/legal/ImprintScreen';
import TermsOfServiceScreen from '@/legal/TermsOfServiceScreen';
import { useThemeColors, useNavigationTheme } from '@/theme/colors';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import FirstRunGate from '@/onboarding/FirstRunGate';
import PushDeepLinkRouter from '@/notifications/PushDeepLinkRouter';
import { setNavigationReady } from '@/notifications/pushTargetStore';
import { goToTab, navigationRef } from './navigationRef';
import { resolveReturnTo } from './tabs';
import { useWards } from '@/hooks/useWards';

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
  Verein: { tab?: 'info' | 'mitglieder' | 'verwaltung' | 'profil'; memberId?: string } | undefined;
  Kalender: { tab?: 'termine' | 'verfuegbarkeit' | 'treffen'; eventId?: string } | undefined;
  Standorte: { tab?: 'orte' | 'material'; locationId?: string } | undefined;
  Mehr: undefined;
  Suche: undefined;
  JoinClub: undefined;
  CreateClub: undefined;
  ClubApplications: undefined;
  ProfileModules: undefined;
  Notifications: undefined;
  Mitteilungen: undefined;
  Heute: undefined;
  PrivacyCenter: undefined;
  Abstimmungen: { ballotId?: string } | undefined;
  Versammlung: { meetingId?: string } | undefined;
  MeineDokumente: undefined;
  Archiv: undefined;
  Bestaetigungen: undefined;
  Mitgliedsausweis: undefined;
  AusweisKontrolle: undefined;
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

/** Heute is for signed-in users: a guest (e.g. after signing out while it was open) is moved to the guest start page. */
function DashboardGate(props: React.ComponentProps<typeof DashboardScreen>) {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) goToTab('Home');
  }, [isAuthenticated]);
  return isAuthenticated ? <DashboardScreen {...props} /> : null;
}

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
  const { t } = useLanguage();
  const { hasWards, guardianOnly } = useWards();
  // Detail screens reached from a tab get a visible title and back arrow (swipe/hardware back keep working).
  const sub = (titleKey: string) => ({ headerShown: true, title: t(titleKey), headerBackTitle: t('common.back') });

  return (
    // Navbar sits here, outside the Navigator's own screens, so it stays
    // mounted across every route below without being wired into five
    // separate `header` options -- deliberately not shown for
    // TwoFactorNavigator (see AppNavigator's own comment on that).
    <View style={{ flex: 1 }}>
      <Navbar />
      {/* Terms of service and the one-time introduction, on whichever screen the app opens first. */}
      <FirstRunGate />
      {/* native-stack defaults contentStyle to white; needed for the
          Android system bars, see App.tsx's StatusBar/NavigationBar. */}
      <RootStack.Navigator
        // Already-authenticated users skip the guest-first Home screen and
        // land straight on Dashboard; guests still see Home first.
        initialRouteName={isAuthenticated ? 'Dashboard' : 'Home'}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.background } }}
      >
      <RootStack.Screen name="Home" component={HomeScreen} />
      <RootStack.Screen name="Dashboard" component={DashboardGate} />

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

      <RootStack.Screen name="Mehr" component={MehrScreen} />

      <RootStack.Screen name="Suche" options={sub('search.title')}>
        {() => (
          <RequireAuth>
            <SucheScreen />
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

      <RootStack.Screen name="CreateClub">
        {(props) => (
          <RequireAuth>
            <CreateClubScreen {...props} />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="ClubApplications" options={sub('verein.applications.open')}>
        {() => (
          <RequireAuth>
            <ClubApplicationsScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="ProfileModules" options={sub('forms.pm.title')}>
        {() => (
          <RequireAuth>
            <ProfileModulesScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Notifications" options={sub('mehr.platform')}>
        {() => (
          <RequireAuth>
            <NotificationsScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Mitteilungen">
        {() => (
          <RequireAuth>
            <MitteilungenScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Heute">
        {(props) => (
          <RequireAuth>
            <HeuteScreen {...props} />
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
                // Replaces Login (no stack growth); a guardian-only account never lands on club-only screens.
                goToTab(resolveReturnTo(route.params?.returnTo, { isAuthenticated: true, hasWards, guardianOnly }));
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
                return { success: false, error: 'Email and password are required.', status: 400 };
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
                goToTab('Home');
              }
              return result;
            }}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="PrivacyCenter">
        {(props) => (
          <RequireAuth>
            <PrivacyCenterScreen {...props} />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Abstimmungen" options={sub('assembly.dashboard.Abstimmungen')}>
        {(props) => (
          <RequireAuth>
            <AbstimmungenScreen {...props} />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Versammlung" options={sub('assembly.dashboard.Versammlung')}>
        {(props) => (
          <RequireAuth>
            <VersammlungScreen {...props} />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="MeineDokumente" options={sub('mydocs.entry')}>
        {() => (
          <RequireAuth>
            <MeineDokumenteScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Archiv" options={sub('archive.entry')}>
        {() => (
          <RequireAuth>
            <ArchivScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Bestaetigungen" options={sub('ack.entry')}>
        {() => (
          <RequireAuth>
            <BestaetigungenScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Mitgliedsausweis" options={sub('card.entry')}>
        {() => (
          <RequireAuth>
            <MitgliedsausweisScreen />
          </RequireAuth>
        )}
      </RootStack.Screen>

      <RootStack.Screen name="AusweisKontrolle" options={sub('check.entry')}>
        {() => (
          <RequireAuth>
            <AusweisKontrolleScreen />
          </RequireAuth>
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
      <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={() => setNavigationReady(true)}>
        {twoFactorPending ? <TwoFactorNavigator /> : <MainNavigator />}
        {/* Routes a tapped push (Wave 9 M3); renders nothing. */}
        <PushDeepLinkRouter />
        {/* Guardian-only accounts start on "Heute" (Wave 10 M5); renders nothing. */}
        <GuardianStartRedirect />
      </NavigationContainer>
    </AppLockGate>
  );
}
