import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, Calendar, Ellipsis, Megaphone, Users, type LucideIcon } from 'lucide-react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { goToTab, navigationRef } from '@/navigation/navigationRef';
import { tabForRoute, tabTarget, visibleTabs, type TabKey } from '@/navigation/tabs';
import { getShowNavbarTitles } from '@/settings/appSettingsStorage';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useUnreadCount } from '@/hooks/useClubInbox';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useWards } from '@/hooks/useWards';

const TAB_META: Record<TabKey, { labelKey: string; Icon: LucideIcon }> = {
    heute: { labelKey: 'nav.heute', Icon: CalendarCheck },
    kalender: { labelKey: 'nav.kalender', Icon: Calendar },
    mitteilungen: { labelKey: 'nav.mitteilungen', Icon: Megaphone },
    verein: { labelKey: 'nav.verein', Icon: Users },
    mehr: { labelKey: 'nav.mehr', Icon: Ellipsis },
};

/**
 * Bottom tab bar (Wave 14 N1): Heute | Kalender | Mitteilungen | Verein | Mehr -- the same five for every role, only
 * the content behind them differs (administration is a permission-gated section inside Verein, see
 * `components/verein/VerwaltungTab.tsx`). A guardian-only account has no club and sees Heute and Mehr. Which stack
 * routes belong to which tab is defined in `navigation/tabs.ts`, so a sub-screen keeps its parent tab highlighted.
 *
 * Rendered as a NavigationContainer sibling (see AppNavigator.tsx's MainNavigator), so it uses the imperative
 * `navigationRef` instead of `useNavigation`. Guests see all tabs; the gated screens send them to Login on open
 * (`RequireAuth`), the guest "Heute" is the Home screen.
 */
export default function Navbar() {
    const { t } = useLanguage();
    const themeColors = useThemeColors();
    const insets = useSafeAreaInsets();
    const { isAuthenticated } = useAuth();
    const [activeRoute, setActiveRoute] = useState<string | undefined>();
    const [showTitles, setShowTitles] = useState(true);
    const platformUnread = useUnreadNotificationCount();
    const { activeClub } = useActiveClub();
    const inboxUnreadCount = useUnreadCount(activeClub?.clubId ?? null);
    const { hasWards, guardianOnly } = useWards();
    const tabs = visibleTabs({ guardianOnly });
    const activeTab = tabForRoute(activeRoute);

    useEffect(() => {
        // SettingsScreen tells the user a restart is required after toggling this -- read once on mount.
        getShowNavbarTitles().then(setShowTitles);
    }, []);

    useEffect(() => {
        const unsubscribe = navigationRef.addListener('state', () => {
            setActiveRoute(navigationRef.getCurrentRoute()?.name);
        });
        if (navigationRef.isReady()) {
            // Seeds the initial highlight from the ref's already-settled state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveRoute(navigationRef.getCurrentRoute()?.name);
        }
        return unsubscribe;
    }, []);

    const bottomOffset = Math.max(insets.bottom + 12, 24);

    return (
        <View
            pointerEvents="box-none"
            // zIndex is required: Navbar renders before RootStack.Navigator as a JSX sibling and each screen's
            // opaque background would otherwise paint over this floating pill on web and Android.
            style={{ position: 'absolute', left: 0, right: 0, bottom: bottomOffset, alignItems: 'center', zIndex: 50, elevation: 50 }}
        >
            <View
                accessibilityRole="tablist"
                className="flex-row w-[92%] h-16 rounded-full items-center justify-around bg-primary dark:bg-primary-dark px-2 shadow-xl"
                style={{ elevation: 10 }}
            >
                {tabs.map((tab) => {
                    const { labelKey, Icon } = TAB_META[tab];
                    const isActive = activeTab === tab;
                    // Messages: club inbox. More: platform notices live there.
                    const badge = tab === 'mitteilungen' ? inboxUnreadCount : tab === 'mehr' ? platformUnread : 0;
                    const label = t(labelKey);
                    return (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => goToTab(tabTarget(tab, { isAuthenticated, hasWards, guardianOnly }))}
                            activeOpacity={0.7}
                            accessibilityRole="tab"
                            accessibilityLabel={badge > 0 ? t('nav.badge-label', { label, count: badge }) : label}
                            accessibilityState={{ selected: isActive }}
                            className="flex-1 items-center justify-center"
                            style={{ minHeight: 48 }}
                        >
                            <View>
                                <Icon size={22} color={themeColors.primaryForeground} strokeWidth={isActive ? 2.75 : 2} />
                                {badge > 0 && (
                                    <View className="absolute -right-2 -top-1 min-w-[16px] h-[16px] rounded-full items-center justify-center bg-destructive px-0.5">
                                        <Text className="text-[10px] font-bold text-white">{badge > 9 ? '9+' : badge}</Text>
                                    </View>
                                )}
                            </View>
                            {showTitles && (
                                <Text
                                    numberOfLines={1}
                                    maxFontSizeMultiplier={1.3}
                                    className={`text-[11px] mt-0.5 ${isActive ? 'font-bold underline' : 'font-medium'}`}
                                    style={{ color: themeColors.primaryForeground }}
                                >
                                    {label}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
