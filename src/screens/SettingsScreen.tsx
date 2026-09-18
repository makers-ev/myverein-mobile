import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Linking, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colorScheme, useColorScheme } from 'nativewind';
import Constants from 'expo-constants';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { supportedLanguages } from '@/contexts/translation/supportedLanguages';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/auth/AuthProvider';
import Logo from '@/components/Logo';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';

// Component imports
import { SettingsSwitchOption } from '@/components/Settings/SettingsSwitchOption';
import { SettingsDropdownOption } from '@/components/Settings/SettingsDropdownOption';

// Modal imports
import ConfirmationModal from '@/components/Modals/ConfirmationModal';
import ConfirmationInputModal from '@/components/Modals/ConfirmationInputModal';
import InfoModal from '@/components/Modals/InfoModal';
import SetupPinModal from '@/components/Modals/SetupPinModal';
import VerifyPinModal from '@/components/Modals/VerifyPinModal';
import IntroModal from '@/onboarding/IntroModal';

import { getAppLockPin, setAppLockPin, clearAppLockPin } from '@/auth/appLockStorage';
import { useAttemptLockout } from '@/hooks/useAttemptLockout';
import {
    getShowTopbarTitles,
    setShowTopbarTitles as persistShowTopbarTitles,
    getShowNavbarTitles,
    setShowNavbarTitles as persistShowNavbarTitles,
} from '@/settings/appSettingsStorage';
import { setStoredTheme } from '@/theme/themePreferenceStorage';
import { usePalette } from '@/theme/PaletteProvider';
import { palettes, predefinedPaletteIds } from '@/theme/palettes';
import PaletteCustomEditor from '@/components/Settings/PaletteCustomEditor';

interface SettingsScreenProps {
  onLogout?: () => void;
  onDeleteAccount?: (password: string) => Promise<{ success: boolean; error?: string }>;
}

const openURL = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
};

/** Small reusable card wrapper so every settings section looks the same. */
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
            <Text className="text-base font-bold text-foreground dark:text-foreground-dark">{title}</Text>
            {subtitle && (
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mt-0.5 mb-1">{subtitle}</Text>
            )}
            <View className="mt-2">{children}</View>
        </View>
    );
}

const CONTACT_URL = 'https://example.com/contact';

export default function SettingsScreen({ onLogout, onDeleteAccount }: SettingsScreenProps) {
    const { t, setLanguage, language } = useLanguage();
    const navigation = useNavigation<any>();
    const { colorScheme: activeColorScheme } = useColorScheme();
    const { paletteId, setPaletteId, customAnchors, setCustomAnchors } = usePalette();
    const appVersion = Constants.expoConfig?.version ?? 'Unknown';
    const {
        isAuthenticated,
        user,
        updateProfile,
        changePassword,
        listSessions,
        revokeSession,
        enableTwoFactor,
        disableTwoFactor,
        verifyTwoFactor,
    } = useAuth();

    // App Lock State
    const [appLockActive, setAppLockActive] = useState<boolean>(false);
    const [storedPin, setStoredPin] = useState<string | null>(null);

    // Modals Visibility
    const [isSetupPinModalVisible, setIsSetupPinModalVisible] = useState(false);
    const [isVerifyPinModalVisible, setIsVerifyPinModalVisible] = useState(false);
    const [isIntroModalVisible, setIsIntroModalVisible] = useState(false);

    // Brute-force protection for the "verify PIN to remove App Lock" flow.
    // Owned here (the parent) rather than inside VerifyPinModal so that
    // closing/reopening the modal does not reset the attempt counter --
    // the modal unmounts its own state when hidden, this screen does not.
    const {
        isLocked: isPinVerifyLocked,
        remainingSeconds: pinVerifyLockoutSeconds,
        attemptsRemaining: pinVerifyAttemptsRemaining,
        registerFailure: registerPinVerifyFailure,
        registerSuccess: registerPinVerifySuccess,
    } = useAttemptLockout();

    // UI States
    const [appLockButtonTitle, setAppLockButtonTitle] = useState<string>(t('settings.create-pin'));

    const [logoutPopup, setLogoutPopup] = useState<boolean>(false);
    const [deleteAccountPopup, setDeleteAccountPopup] = useState<boolean>(false);
    const [showTopbarTitles, setShowTopbarTitles] = useState<boolean>(false);
    const [showNavbarTitles, setShowNavbarTitles] = useState<boolean>(false);
    const [updateTitleToggleModalVisible, setUpdateTitleToggleModalVisible] = useState<boolean>(false);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    const languageOptions = supportedLanguages.map((lang) => ({ label: lang.nativeLabel, value: lang.id }));

    const handleLanguageChange = (selectedLanguage: any) => {
        // useLanguage()'s setLanguage already persists (see
        // LanguageContext.tsx) -- nothing else to do here.
        setLanguage(selectedLanguage);
    };

    const toggleShowTopbarTitles = (value: boolean) => {
        setShowTopbarTitles(value);
        void persistShowTopbarTitles(value);
        setUpdateTitleToggleModalVisible(true);
    };

    const toggleShowNavbarTitles = (value: boolean) => {
        setShowNavbarTitles(value);
        void persistShowNavbarTitles(value);
        setUpdateTitleToggleModalVisible(true);
    };

    // --- LOGIC: Load Settings ---
    useEffect(() => {
        const loadSettings = async () => {
            setShowTopbarTitles(await getShowTopbarTitles());
            setShowNavbarTitles(await getShowNavbarTitles());

            // App Lock PIN is persisted for real via expo-secure-store (the
            // same backend used for the Better Auth session) so it survives
            // app restarts, and is actually enforced by AppLockGate.
            const pin = await getAppLockPin();
            setStoredPin(pin);
            setAppLockActive(!!pin);
            setAppLockButtonTitle(t(pin ? 'settings.remove-pin' : 'settings.create-pin'));
        };
        loadSettings();
    }, [t]);

    // Auto-dismiss the little "Saved" toast used across the sections below.
    useEffect(() => {
        if (!savedMessage) return;
        const timeout = setTimeout(() => setSavedMessage(null), 3000);
        return () => clearTimeout(timeout);
    }, [savedMessage]);

    // --- LOGIC: PIN Handling ---

    const handlePinButtonPress = () => {
        if (appLockActive) {
            // If active -> Open Verify Modal to remove
            setIsVerifyPinModalVisible(true);
        } else {
            // If inactive -> Open Setup Modal to create
            setIsSetupPinModalVisible(true);
        }
    };

    // 1. PIN creation (Callback from SetupPinModal)
    const onPinCreated = async (newPin: string) => {
        await setAppLockPin(newPin);
        setStoredPin(newPin);
        setAppLockActive(true);
        setAppLockButtonTitle(t('settings.remove-pin'));
        setIsSetupPinModalVisible(false);
    };

    // 2. PIN removal (Callback from VerifyPinModal)
    const onPinRemoved = async () => {
        await clearAppLockPin();
        setStoredPin(null);
        setAppLockActive(false);
        setAppLockButtonTitle(t('settings.create-pin'));
        setIsVerifyPinModalVisible(false);
        registerPinVerifySuccess();
    };

    return (
        <KeyboardAwareScreen
            className="bg-background dark:bg-background-dark"
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        >

            <SetupPinModal
                visible={isSetupPinModalVisible}
                onClose={() => setIsSetupPinModalVisible(false)}
                onConfirm={onPinCreated}
            />

            <VerifyPinModal
                visible={isVerifyPinModalVisible}
                onClose={() => setIsVerifyPinModalVisible(false)}
                onSuccess={onPinRemoved}
                currentPin={storedPin}
                isLocked={isPinVerifyLocked}
                lockoutSecondsRemaining={pinVerifyLockoutSeconds}
                attemptsRemaining={pinVerifyAttemptsRemaining}
                onFailedAttempt={registerPinVerifyFailure}
                onSuccessfulAttempt={registerPinVerifySuccess}
            />

            <ConfirmationModal
                visible={logoutPopup}
                onClose={() => setLogoutPopup(false)}
                title={t('settings.logout-confirm')}
                buttons={[
                    {
                        text: t('settings.continue'),
                        onPress: () => {
                            setLogoutPopup(false);
                            if (onLogout) onLogout();
                        },
                        color: 'bg-destructive',
                    },
                    {
                        text: t('settings.cancel'),
                        onPress: () => setLogoutPopup(false),
                        color: 'bg-green-600',
                    },
                ]}
                titleColor="text-destructive"
            />

            <ConfirmationInputModal
                visible={deleteAccountPopup}
                onClose={() => setDeleteAccountPopup(false)}
                title={t('settings.delete-account-confirm')}
                titleColor="text-destructive"
                message={t('settings.delete-password-prompt')}
                messageColor="text-muted-foreground"
                secureTextEntry
                bottomInfoText={t('settings.confirmation-input-modal.bottom-info')}
                bottomInfoLinkHypertext={t('settings.confirmation-input-modal.bottom-info-link')}
                bottomInfoLinkTarget={"https://example.com"}
                confirmText={t('settings.continue')}
                cancelText={t('settings.cancel')}
                onConfirm={async (password) => {
                    setDeleteAccountPopup(false);
                    if (!onDeleteAccount) return;
                    const result = await onDeleteAccount(password);
                    if (!result.success) {
                        Alert.alert(t('alert.general-error-title'), result.error ?? t('alert.general-error-description'));
                    }
                }}
            />

            <IntroModal
                visible={isIntroModalVisible}
                onClose={() => setIsIntroModalVisible(false)}
            />

            <InfoModal
                visible={updateTitleToggleModalVisible}
                onClose={() => setUpdateTitleToggleModalVisible(false)}
                title={t('settings.updateTitle-modal-title')}
                message={t('settings.updateTitle-modal-message')}
                titleColor="text-blue-600"
                messageColor="text-gray-600"
                showCloseIcon={true}
            />

                <View className="items-center mb-6">
                    <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">{t('settings.title')}</Text>
                </View>

                {isAuthenticated ? (
                    <>
                        <ProfileSection user={user} updateProfile={updateProfile} onSaved={() => setSavedMessage(t('settings.saved'))} />

                        <SecuritySection
                            changePassword={changePassword}
                            enableTwoFactor={enableTwoFactor}
                            disableTwoFactor={disableTwoFactor}
                            verifyTwoFactor={verifyTwoFactor}
                            twoFactorEnabled={Boolean((user as { twoFactorEnabled?: boolean } | null)?.twoFactorEnabled)}
                            onSaved={(message) => setSavedMessage(message)}
                        />

                        <SessionsSection listSessions={listSessions} revokeSession={revokeSession} currentSessionToken={undefined} onSaved={(message) => setSavedMessage(message)} />

                        <DebugSection />
                    </>
                ) : (
                    // Settings itself isn't gated -- language/theme/App Lock/
                    // legal apply to guests too. Only the account-specific
                    // sections above need a real session, so this replaces
                    // them rather than blocking the whole screen.
                    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
                        <Text className="text-foreground dark:text-foreground-dark text-base font-semibold mb-1">
                            {t('home.guest-heading')}
                        </Text>
                        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">
                            {t('home.guest-body')}
                        </Text>
                        <View className="flex-row" style={{ gap: 12 }}>
                            <TouchableOpacity
                                className="flex-1 bg-primary dark:bg-primary-dark rounded-xl py-3"
                                onPress={() => navigation.navigate('Signup')}
                            >
                                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-center font-bold">
                                    {t('home.signup-cta')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 border border-border dark:border-border-dark rounded-xl py-3"
                                onPress={() => navigation.navigate('Login', {})}
                            >
                                <Text className="text-foreground dark:text-foreground-dark text-center font-bold">
                                    {t('home.login-cta')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <SectionCard title={t('settings.choose-language')}>
                    <SettingsDropdownOption
                        infoField={t('settings.choose-language')}
                        isDropdown={true}
                        dropdownOptions={languageOptions}
                        selectedValue={language}
                        showSelectedValueInTitle={true}
                        onDropdownSelect={handleLanguageChange}
                        note={null}
                    />
                    <View className="mt-3">
                        <SettingsSwitchOption
                            infoField={t('settings.show-topbar-title')}
                            selectedValue={showTopbarTitles}
                            onSwitchToggle={toggleShowTopbarTitles}
                        />
                    </View>
                    <View className="mt-3">
                        <SettingsSwitchOption
                            infoField={t('settings.show-navbar-title')}
                            selectedValue={showNavbarTitles}
                            onSwitchToggle={toggleShowNavbarTitles}
                        />
                    </View>
                </SectionCard>

                <SectionCard title={t('settings.section-appearance')}>
                    <SettingsSwitchOption
                        infoField={t('settings.dark-mode')}
                        selectedValue={activeColorScheme === 'dark'}
                        onSwitchToggle={(value) => {
                            const theme = value ? 'dark' : 'light';
                            colorScheme.set(theme);
                            void setStoredTheme(theme);
                        }}
                    />
                    <View className="mt-3">
                        <SettingsDropdownOption
                            infoField={t('settings.color-palette')}
                            isDropdown={true}
                            dropdownOptions={[
                                ...predefinedPaletteIds.map((id) => ({ label: palettes[id].label, value: id })),
                                { label: t('settings.color-palette-custom'), value: 'custom' },
                            ]}
                            selectedValue={paletteId}
                            showSelectedValueInTitle={true}
                            onDropdownSelect={(value) => setPaletteId(value as typeof paletteId)}
                            note={null}
                        />
                    </View>
                    {paletteId === 'custom' && (
                        <PaletteCustomEditor customAnchors={customAnchors} onChange={setCustomAnchors} />
                    )}
                </SectionCard>

                <SectionCard title={t('settings.section-legal')}>
                    <TouchableOpacity className="py-2" onPress={() => setIsIntroModalVisible(true)}>
                        <Text className="text-foreground dark:text-foreground-dark">{t('settings.replay-intro')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="py-2" onPress={() => navigation.navigate('PrivacyPolicy')}>
                        <Text className="text-foreground dark:text-foreground-dark">{t('settings.legal.privacy')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="py-2" onPress={() => navigation.navigate('TermsOfService')}>
                        <Text className="text-foreground dark:text-foreground-dark">{t('settings.legal.tos')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="py-2" onPress={() => navigation.navigate('Imprint')}>
                        <Text className="text-foreground dark:text-foreground-dark">{t('settings.legal.imprint')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="py-2" onPress={() => openURL(CONTACT_URL)}>
                        <Text className="text-foreground dark:text-foreground-dark">{t('settings.legal.contact')}</Text>
                    </TouchableOpacity>
                </SectionCard>

                <SectionCard title={t('settings.section-app-lock')}>
                    <TouchableOpacity
                        className={`${appLockActive ? 'bg-destructive' : 'bg-primary dark:bg-primary-dark'} py-2.5 px-4 rounded-lg`}
                        onPress={handlePinButtonPress}>
                        <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold text-center">
                            {appLockButtonTitle}
                        </Text>
                    </TouchableOpacity>
                </SectionCard>

                {isAuthenticated && (
                <View className="items-center justify-center mb-5">
                    <View className="w-full border-2 border-destructive p-4 rounded-md bg-card dark:bg-card-dark">
                        <Text className="text-lg font-bold text-destructive mb-2 text-center">
                            {t('settings.danger-zone')}
                        </Text>

                        <TouchableOpacity
                            className="bg-destructive py-2 px-4 rounded-md my-1"
                            onPress={() => setLogoutPopup(true)}>
                            <Text className="text-primary-foreground text-base font-bold text-center">
                                {t('settings.logout')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="bg-destructive py-2 px-4 rounded-md my-1"
                            onPress={() => setDeleteAccountPopup(true)}>
                            <Text className="text-primary-foreground text-base font-bold text-center">
                                {t('settings.delete-account')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
                )}

                {savedMessage && (
                    <Text className="text-center text-primary dark:text-primary-dark text-sm mb-4">{savedMessage}</Text>
                )}

                <View className="items-center mt-2">
                    <Logo size={32} hideWordmark />
                    <Text className="text-center text-muted-foreground dark:text-muted-foreground-dark text-sm mt-3">
                        © {new Date().getFullYear()} LPJ IT-Solutions
                    </Text>
                    <Text className="text-center text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">
                        {t('settings.app-version')}: {appVersion}
                    </Text>
                </View>
        </KeyboardAwareScreen>
    )
}

// --- Profile: wired to Better Auth's real /update-user endpoint via AuthProvider.updateProfile ---
function ProfileSection({
    user,
    updateProfile,
    onSaved,
}: {
    user: { name?: string | null; email?: string | null } | null;
    updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>;
    onSaved: () => void;
}) {
    const { t } = useLanguage();
    const themeColors = useThemeColors();
    const [name, setName] = useState(user?.name ?? '');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Resyncs the editable field when the session's name changes underneath
    // it (e.g. after a save elsewhere) -- React's documented "adjusting
    // state when a prop changes" pattern (compare-and-set during render)
    // instead of a useEffect, since the effect version fires an extra
    // render for every keystroke's re-render too.
    const [syncedName, setSyncedName] = useState(user?.name ?? '');
    if ((user?.name ?? '') !== syncedName) {
        setSyncedName(user?.name ?? '');
        setName(user?.name ?? '');
    }

    const handleSave = async () => {
        setSubmitting(true);
        setError(null);
        const result = await updateProfile(name);
        setSubmitting(false);
        if (!result.success) {
            setError(result.error ?? t('alert.general-error-description'));
            return;
        }
        onSaved();
    };

    return (
        <SectionCard title={t('settings.section-profile')}>
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">{t('settings.field-name')}</Text>
            <TextInput
                className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
                value={name}
                onChangeText={setName}
            />
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">{t('settings.field-email')}</Text>
            <Text className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-muted-foreground dark:text-muted-foreground-dark border border-border dark:border-border-dark mb-3">
                {user?.email}
            </Text>
            {error && <Text className="text-destructive text-sm mb-2">{error}</Text>}
            <TouchableOpacity
                className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center ${submitting ? 'opacity-70' : ''}`}
                onPress={handleSave}
                disabled={submitting}
            >
                {submitting ? (
                    <ActivityIndicator color={themeColors.primaryForeground} />
                ) : (
                    <Text className="text-primary-foreground dark:text-primary-foreground-dark font-semibold">
                        {t('settings.save')}
                    </Text>
                )}
            </TouchableOpacity>
        </SectionCard>
    );
}

// --- Security: change password + 2FA, wired to Better Auth's real
// /change-password and twoFactor plugin endpoints via AuthProvider ---
function SecuritySection({
    changePassword,
    enableTwoFactor,
    disableTwoFactor,
    verifyTwoFactor,
    twoFactorEnabled,
    onSaved,
}: {
    changePassword: (current: string, next: string) => Promise<{ success: boolean; error?: string }>;
    enableTwoFactor: (password: string) => Promise<{ success: boolean; error?: string; totpUri?: string }>;
    disableTwoFactor: (password: string) => Promise<{ success: boolean; error?: string }>;
    verifyTwoFactor: (code: string) => Promise<{ success: boolean; error?: string }>;
    twoFactorEnabled: boolean;
    onSaved: (message: string) => void;
}) {
    const { t } = useLanguage();
    const themeColors = useThemeColors();

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSubmitting, setPasswordSubmitting] = useState(false);

    const handleChangePassword = async () => {
        setPasswordSubmitting(true);
        setPasswordError(null);
        const result = await changePassword(currentPassword, newPassword);
        setPasswordSubmitting(false);
        if (!result.success) {
            setPasswordError(result.error ?? t('alert.general-error-description'));
            return;
        }
        setCurrentPassword('');
        setNewPassword('');
        setShowPasswordForm(false);
        onSaved(t('settings.password-changed'));
    };

    const [twoFactorStep, setTwoFactorStep] = useState<'idle' | 'enable' | 'verify' | 'disable'>('idle');
    const [twoFactorPassword, setTwoFactorPassword] = useState('');
    const [totpUri, setTotpUri] = useState<string | null>(null);
    const [totpCode, setTotpCode] = useState('');
    const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
    const [twoFactorSubmitting, setTwoFactorSubmitting] = useState(false);

    const resetTwoFactorFlow = () => {
        setTwoFactorStep('idle');
        setTwoFactorPassword('');
        setTotpUri(null);
        setTotpCode('');
        setTwoFactorError(null);
    };

    const startTwoFactorEnable = async () => {
        setTwoFactorSubmitting(true);
        setTwoFactorError(null);
        const result = await enableTwoFactor(twoFactorPassword);
        setTwoFactorSubmitting(false);
        if (!result.success) {
            setTwoFactorError(result.error ?? t('alert.general-error-description'));
            return;
        }
        setTotpUri(result.totpUri ?? null);
        setTwoFactorPassword('');
        setTwoFactorStep('verify');
    };

    const handleVerifyTwoFactor = async () => {
        setTwoFactorSubmitting(true);
        setTwoFactorError(null);
        const result = await verifyTwoFactor(totpCode);
        setTwoFactorSubmitting(false);
        if (!result.success) {
            setTwoFactorError(result.error ?? t('alert.general-error-description'));
            return;
        }
        resetTwoFactorFlow();
        onSaved(t('settings.2fa-enabled'));
    };

    const handleDisableTwoFactor = async () => {
        setTwoFactorSubmitting(true);
        setTwoFactorError(null);
        const result = await disableTwoFactor(twoFactorPassword);
        setTwoFactorSubmitting(false);
        if (!result.success) {
            setTwoFactorError(result.error ?? t('alert.general-error-description'));
            return;
        }
        resetTwoFactorFlow();
        onSaved(t('settings.2fa-disabled'));
    };

    return (
        <SectionCard title={t('settings.section-security')}>
            {/* Change password */}
            <View className="border border-dashed border-border dark:border-border-dark rounded-lg p-3 mb-3">
                <Text className="font-semibold text-foreground dark:text-foreground-dark">{t('settings.change-password')}</Text>

                {!showPasswordForm ? (
                    <TouchableOpacity
                        className="mt-2 self-start bg-muted dark:bg-muted-dark rounded-lg px-3 py-2"
                        onPress={() => setShowPasswordForm(true)}
                    >
                        <Text className="text-foreground dark:text-foreground-dark">{t('settings.change-password')}</Text>
                    </TouchableOpacity>
                ) : (
                    <View className="mt-2">
                        <TextInput
                            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-2"
                            placeholder={t('settings.current-password')}
                            secureTextEntry
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                        />
                        <TextInput
                            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-2"
                            placeholder={t('settings.new-password')}
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />
                        {passwordError && <Text className="text-destructive text-sm mb-2">{passwordError}</Text>}
                        <View className="flex-row" style={{ gap: 8 }}>
                            <TouchableOpacity
                                className={`bg-primary dark:bg-primary-dark rounded-lg px-3 py-2 ${passwordSubmitting ? 'opacity-70' : ''}`}
                                onPress={handleChangePassword}
                                disabled={passwordSubmitting || !currentPassword || newPassword.length < 8}
                            >
                                {passwordSubmitting ? (
                                    <ActivityIndicator color={themeColors.primaryForeground} />
                                ) : (
                                    <Text className="text-primary-foreground dark:text-primary-foreground-dark font-semibold">
                                        {t('settings.save')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="border border-border dark:border-border-dark rounded-lg px-3 py-2"
                                onPress={() => {
                                    setShowPasswordForm(false);
                                    setPasswordError(null);
                                    setCurrentPassword('');
                                    setNewPassword('');
                                }}
                            >
                                <Text className="text-foreground dark:text-foreground-dark">{t('settings.cancel')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Two-factor authentication */}
            <View className="border border-dashed border-border dark:border-border-dark rounded-lg p-3">
                <View className="flex-row justify-between items-center">
                    <Text className="font-semibold text-foreground dark:text-foreground-dark">{t('settings.two-factor')}</Text>
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                        {twoFactorEnabled ? t('settings.2fa-enabled-label') : t('settings.2fa-disabled-label')}
                    </Text>
                </View>

                {twoFactorStep === 'idle' && (
                    <TouchableOpacity
                        className={`mt-2 self-start rounded-lg px-3 py-2 ${twoFactorEnabled ? 'bg-muted dark:bg-muted-dark' : 'bg-primary dark:bg-primary-dark'}`}
                        onPress={() => setTwoFactorStep(twoFactorEnabled ? 'disable' : 'enable')}
                    >
                        <Text className={twoFactorEnabled ? 'text-foreground dark:text-foreground-dark' : 'text-primary-foreground dark:text-primary-foreground-dark'}>
                            {twoFactorEnabled ? t('settings.disable-2fa') : t('settings.enable-2fa')}
                        </Text>
                    </TouchableOpacity>
                )}

                {(twoFactorStep === 'enable' || twoFactorStep === 'disable') && (
                    <View className="mt-2">
                        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-2">
                            {t('settings.2fa-password-prompt')}
                        </Text>
                        <TextInput
                            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-2"
                            placeholder={t('settings.current-password')}
                            secureTextEntry
                            value={twoFactorPassword}
                            onChangeText={setTwoFactorPassword}
                        />
                        {twoFactorError && <Text className="text-destructive text-sm mb-2">{twoFactorError}</Text>}
                        <View className="flex-row" style={{ gap: 8 }}>
                            <TouchableOpacity
                                className={`rounded-lg px-3 py-2 ${twoFactorStep === 'disable' ? 'bg-destructive' : 'bg-primary dark:bg-primary-dark'} ${twoFactorSubmitting ? 'opacity-70' : ''}`}
                                onPress={twoFactorStep === 'disable' ? handleDisableTwoFactor : startTwoFactorEnable}
                                disabled={twoFactorSubmitting || !twoFactorPassword}
                            >
                                {twoFactorSubmitting ? (
                                    <ActivityIndicator color={themeColors.primaryForeground} />
                                ) : (
                                    <Text className="text-primary-foreground font-semibold">
                                        {twoFactorStep === 'disable' ? t('settings.disable-2fa') : t('settings.continue')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity className="border border-border dark:border-border-dark rounded-lg px-3 py-2" onPress={resetTwoFactorFlow}>
                                <Text className="text-foreground dark:text-foreground-dark">{t('settings.cancel')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {twoFactorStep === 'verify' && (
                    <View className="mt-2">
                        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-2">
                            {t('settings.2fa-verify-prompt')}
                        </Text>
                        {totpUri && (
                            <Text className="bg-muted dark:bg-muted-dark rounded p-2 text-xs mb-2" selectable>
                                {totpUri}
                            </Text>
                        )}
                        <TextInput
                            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-center tracking-[6px] text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-2"
                            placeholder={t('settings.2fa-code-placeholder')}
                            keyboardType="number-pad"
                            maxLength={6}
                            value={totpCode}
                            onChangeText={setTotpCode}
                        />
                        {twoFactorError && <Text className="text-destructive text-sm mb-2">{twoFactorError}</Text>}
                        <View className="flex-row" style={{ gap: 8 }}>
                            <TouchableOpacity
                                className={`bg-primary dark:bg-primary-dark rounded-lg px-3 py-2 ${twoFactorSubmitting ? 'opacity-70' : ''}`}
                                onPress={handleVerifyTwoFactor}
                                disabled={twoFactorSubmitting || totpCode.length !== 6}
                            >
                                {twoFactorSubmitting ? (
                                    <ActivityIndicator color={themeColors.primaryForeground} />
                                ) : (
                                    <Text className="text-primary-foreground dark:text-primary-foreground-dark font-semibold">
                                        {t('settings.2fa-verify')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity className="border border-border dark:border-border-dark rounded-lg px-3 py-2" onPress={resetTwoFactorFlow}>
                                <Text className="text-foreground dark:text-foreground-dark">{t('settings.cancel')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </SectionCard>
    );
}

// --- Active sessions: wired to Better Auth's real /list-sessions and
// /revoke-session endpoints via AuthProvider ---
function SessionsSection({
    listSessions,
    revokeSession,
    currentSessionToken,
    onSaved,
}: {
    listSessions: () => Promise<{ success: boolean; error?: string; sessions: { id: string; token: string; createdAt: string | Date; userAgent?: string | null }[] }>;
    revokeSession: (token: string) => Promise<{ success: boolean; error?: string }>;
    currentSessionToken?: string;
    onSaved: (message: string) => void;
}) {
    const { t } = useLanguage();
    const themeColors = useThemeColors();
    const [sessions, setSessions] = useState<{ id: string; token: string; createdAt: string | Date; userAgent?: string | null }[] | null>(null);
    const [revokingToken, setRevokingToken] = useState<string | null>(null);

    const refresh = async () => {
        const result = await listSessions();
        setSessions(result.sessions);
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRevoke = async (token: string) => {
        setRevokingToken(token);
        const result = await revokeSession(token);
        setRevokingToken(null);
        if (result.success) {
            onSaved(t('settings.session-revoked'));
            await refresh();
        }
    };

    const otherSessions = (sessions ?? []).filter((s) => s.token !== currentSessionToken);

    return (
        <SectionCard title={t('settings.section-sessions')}>
            {sessions === null ? (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('settings.loading-sessions')}</Text>
            ) : otherSessions.length === 0 ? (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('settings.no-other-sessions')}</Text>
            ) : (
                otherSessions.map((s) => (
                    <View key={s.id} className="flex-row items-center justify-between border border-dashed border-border dark:border-border-dark rounded-lg p-3 mb-2">
                        <View className="flex-1 pr-2">
                            <Text className="text-foreground dark:text-foreground-dark text-sm" numberOfLines={1}>
                                {s.userAgent ?? s.id}
                            </Text>
                            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                                {new Date(s.createdAt).toLocaleString()}
                            </Text>
                        </View>
                        <TouchableOpacity
                            className={`bg-destructive rounded-lg px-3 py-2 ${revokingToken === s.token ? 'opacity-70' : ''}`}
                            onPress={() => handleRevoke(s.token)}
                            disabled={revokingToken === s.token}
                        >
                            {revokingToken === s.token ? (
                                <ActivityIndicator size="small" color={themeColors.primaryForeground} />
                            ) : (
                                <Text className="text-primary-foreground text-xs font-semibold">{t('settings.revoke')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </SectionCard>
    );
}

// --- Track D connection-test panel: plain fetch against the backend's
// public GET /examples/ping, kept intentionally unabstracted as a
// copy-paste starting point for wiring any future route to this app. ---
function DebugSection() {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handlePing = async () => {
        setIsLoading(true);
        setResult(null);
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
        try {
            const response = await fetch(`${backendUrl}/examples/ping`);
            const body = await response.json();
            setResult(JSON.stringify({ status: response.status, timestamp: new Date().toISOString(), body }, null, 2));
        } catch (err) {
            setResult(JSON.stringify({ error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }, null, 2));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SectionCard title={t('settings.section-debug')} subtitle={t('settings.debug-description')}>
            <TouchableOpacity
                className={`self-start bg-muted dark:bg-muted-dark border border-border dark:border-border-dark rounded-lg px-3 py-2 ${isLoading ? 'opacity-70' : ''}`}
                onPress={handlePing}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator />
                ) : (
                    <Text className="text-foreground dark:text-foreground-dark font-semibold">{t('settings.ping')}</Text>
                )}
            </TouchableOpacity>

            {result && (
                <Text className="mt-3 bg-muted dark:bg-muted-dark rounded-lg p-3 text-xs text-foreground dark:text-foreground-dark" selectable>
                    {result}
                </Text>
            )}
        </SectionCard>
    );
}
