import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, Calendar, Ellipsis, Megaphone, Users, type LucideIcon } from 'lucide-react-native';

import PressScale from '@/components/ui/PressScale';
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
 * Bottom tab bar (Wave 14 N1, docked and quiet since the UI polish): Heute | Kalender | Mitteilungen | Verein | Mehr -- the same five for every role, only
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

    const items: TabBarItem[] = tabs.map((tab) => {
        const { labelKey, Icon } = TAB_META[tab];
        // Messages: club inbox. More: platform notices live there.
        const badge = tab === 'mitteilungen' ? inboxUnreadCount : tab === 'mehr' ? platformUnread : 0;
        const label = t(labelKey);
        return { key: tab, label, Icon, badge, accessibilityLabel: badge > 0 ? t('nav.badge-label', { label, count: badge }) : label };
    });

    return (
        <TabBar
            items={items}
            activeKey={activeTab}
            showTitles={showTitles}
            bottomInset={insets.bottom}
            iconColors={{ active: themeColors.primary, inactive: themeColors.mutedForeground }}
            onSelect={(key) => goToTab(tabTarget(key as TabKey, { isAuthenticated, hasWards, guardianOnly }))}
        />
    );
}

/** Height of the docked bar above the bottom safe-area inset (8 padding + 48 item + 1 hairline), so modals can clear it. */
export const TAB_BAR_HEIGHT = 57;

/** Space a bottom-anchored card has to leave free so it does not cover the tab bar (bar + safe area + 12 gap). */
export function tabBarClearance(bottomInset: number): number {
    return TAB_BAR_HEIGHT + Math.max(bottomInset, 8) + 12;
}

export interface TabBarItem {
    key: string;
    label: string;
    Icon: LucideIcon;
    badge: number;
    accessibilityLabel: string;
}

interface TabBarProps {
    items: TabBarItem[];
    activeKey: string | null | undefined;
    showTitles: boolean;
    bottomInset: number;
    iconColors: { active: string; inactive: string };
    onSelect: (key: string) => void;
}

/**
 * The bar itself, docked to the bottom edge: card surface with a hairline on top, no shadow, no coloured fill. The
 * active tab gets a small surface step behind its icon plus the primary colour on the icon; the label switches to the
 * foreground colour (no underline, no heavier stroke), so the bar stays quiet next to the content.
 */
export function TabBar({ items, activeKey, showTitles, bottomInset, iconColors, onSelect }: TabBarProps) {
    return (
        <View
            pointerEvents="box-none"
            // zIndex is required: Navbar renders before RootStack.Navigator as a JSX sibling and each screen's
            // opaque background would otherwise paint over this bar on web and Android.
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50 }}
        >
            <View
                accessibilityRole="tablist"
                className="flex-row bg-card dark:bg-card-dark border-t border-border dark:border-border-dark px-2 pt-2"
                style={{ paddingBottom: Math.max(bottomInset, 8) }}
            >
                {items.map((item) => {
                    const isActive = activeKey === item.key;
                    const { Icon, badge } = item;
                    return (
                        <PressScale
                            key={item.key}
                            onPress={() => onSelect(item.key)}
                            accessibilityRole="tab"
                            accessibilityLabel={item.accessibilityLabel}
                            accessibilityState={{ selected: isActive }}
                            className="flex-1 items-center justify-center"
                            style={{ minHeight: 48 }}
                            scale={0.96}
                        >
                            <View
                                className={`items-center justify-center rounded-[10px] ${isActive ? 'bg-muted dark:bg-muted-dark' : ''}`}
                                style={{ width: 56, height: 28 }}
                            >
                                <Icon size={20} color={isActive ? iconColors.active : iconColors.inactive} strokeWidth={1.75} />
                                {badge > 0 && (
                                    <View className="absolute right-1 -top-1 min-w-[16px] h-[16px] rounded-[10px] items-center justify-center bg-destructive px-1 border-2 border-card dark:border-card-dark">
                                        <Text className="text-[10px] font-semibold text-white">{badge > 9 ? '9+' : badge}</Text>
                                    </View>
                                )}
                            </View>
                            {showTitles && (
                                <Text
                                    numberOfLines={1}
                                    maxFontSizeMultiplier={1.3}
                                    className={`text-[11px] mt-1 ${isActive ? 'font-semibold text-foreground dark:text-foreground-dark' : 'font-medium text-muted-foreground dark:text-muted-foreground-dark'}`}
                                >
                                    {item.label}
                                </Text>
                            )}
                        </PressScale>
                    );
                })}
            </View>
        </View>
    );
}
