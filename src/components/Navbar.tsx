import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Calendar, Home as HomeIcon, MapPin, Settings as SettingsIcon, Users, type LucideIcon } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { navigate, navigationRef } from '@/navigation/navigationRef';
import { getShowNavbarTitles } from '@/settings/appSettingsStorage';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';

interface NavItem {
    route: 'Home' | 'Verein' | 'Kalender' | 'Standorte' | 'Notifications' | 'Settings';
    labelKey: string;
    Icon: LucideIcon;
}

// Adding a destination is appending one object here, nothing else in this
// component changes. `Verein`/`Kalender`/`Standorte`/`Notifications` are
// gated by `RequireAuth` (see AppNavigator.tsx) -- a guest tapping any of
// them is redirected to Login, same as any other gated screen reached from
// an ungated nav entry.
const NAV_ITEMS: NavItem[] = [
    { route: 'Home', labelKey: 'nav.home', Icon: HomeIcon },
    { route: 'Verein', labelKey: 'nav.verein', Icon: Users },
    { route: 'Kalender', labelKey: 'nav.kalender', Icon: Calendar },
    { route: 'Standorte', labelKey: 'nav.standorte', Icon: MapPin },
    { route: 'Notifications', labelKey: 'nav.notifications', Icon: Bell },
    { route: 'Settings', labelKey: 'nav.settings', Icon: SettingsIcon },
];

/**
 * Floating bottom pill, styled after mycollection-app's `components/
 * PageLayout.tsx` Navbar (freestanding, rounded, absolutely positioned
 * over the screen content rather than taking up layout space) -- rendered
 * as a NavigationContainer sibling (see AppNavigator.tsx's MainNavigator)
 * so it stays mounted across every route without a per-screen `header`
 * option.
 *
 * Being a Navigator sibling (not one of its Screens) means `useNavigation`/
 * `useNavigationState` have no context to read here -- both are only
 * provided within a Navigator's own subtree. Uses the imperative
 * `navigationRef` module instead (the documented "navigating without the
 * navigation prop" pattern), including its own `addListener('state', ...)`
 * subscription to track the active route for highlighting, since
 * `useNavigationState` isn't an option either.
 *
 * Settings is reachable by everyone, guest or signed in -- it isn't gated,
 * so this never needs to branch on auth state (SettingsScreen itself
 * decides what to show once you're there).
 */
export default function Navbar() {
    const { t } = useLanguage();
    const themeColors = useThemeColors();
    const insets = useSafeAreaInsets();
    const [activeRoute, setActiveRoute] = useState<string | undefined>();
    const [showTitles, setShowTitles] = useState(true);
    const unreadCount = useUnreadNotificationCount();

    useEffect(() => {
        // SettingsScreen tells the user a restart is required after
        // toggling this -- reading it once on mount (not reactively)
        // matches that "applies after restart" contract.
        getShowNavbarTitles().then(setShowTitles);
    }, []);

    useEffect(() => {
        const unsubscribe = navigationRef.addListener('state', () => {
            setActiveRoute(navigationRef.getCurrentRoute()?.name);
        });
        if (navigationRef.isReady()) {
            // Seeds the initial highlight from the ref's already-settled
            // state (set before this component mounted) -- not a
            // render-time derivation, so this is a legitimate
            // sync-from-external-source effect.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveRoute(navigationRef.getCurrentRoute()?.name);
        }
        return unsubscribe;
    }, []);

    const bottomOffset = Math.max(insets.bottom + 12, 24);

    return (
        <View
            pointerEvents="box-none"
            // zIndex is required, not decorative -- Navbar renders before
            // RootStack.Navigator as a JSX sibling (see AppNavigator.tsx),
            // and each screen's full-bleed opaque background would
            // otherwise paint over this floating pill in default (source-
            // order) stacking, on web and Android alike.
            style={{ position: 'absolute', left: 0, right: 0, bottom: bottomOffset, alignItems: 'center', zIndex: 50, elevation: 50 }}
        >
            <View
                className="flex-row w-[90%] h-16 rounded-full items-center justify-around bg-primary dark:bg-primary-dark px-2 shadow-xl"
                style={{ elevation: 10 }}
            >
                {NAV_ITEMS.map(({ route, labelKey, Icon }) => {
                    const isActive = activeRoute === route;
                    return (
                        <TouchableOpacity
                            key={route}
                            onPress={() => navigate(route)}
                            activeOpacity={0.7}
                            className="flex-1 items-center justify-center"
                        >
                            <View>
                                <Icon size={22} color={themeColors.primaryForeground} strokeWidth={isActive ? 2.5 : 2} />
                                {route === 'Notifications' && unreadCount > 0 && (
                                    <View
                                        className="absolute -right-1.5 -top-1 min-w-[14px] h-[14px] rounded-full items-center justify-center bg-destructive px-0.5"
                                    >
                                        <Text className="text-[9px] font-bold text-white">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            {showTitles && (
                                <Text
                                    className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}
                                    style={{ color: themeColors.primaryForeground }}
                                >
                                    {t(labelKey)}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
