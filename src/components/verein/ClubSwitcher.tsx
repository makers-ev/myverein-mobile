import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMyClubs } from '@/hooks/useMyClubs';

/**
 * Club context (rule 9: the club is always visible, tapping it switches the club).
 * - `context` (default): the club name as a small line above the screen title (`ScreenHeader`'s `context`), with a
 *   chevron and a 44pt target when there is more than one club; plain text with a single club.
 * - `pill`: the former boxed trigger, for places without a screen header. Renders nothing with a single club.
 * The bottom sheet lists the memberships with the current one marked.
 */
export default function ClubSwitcher({ onBeforeSwitch, variant = 'context' }: { onBeforeSwitch?: (proceed: () => void) => void; variant?: 'context' | 'pill' } = {}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { clubs, activeClub, setActiveClubId } = useMyClubs();
  const [open, setOpen] = useState(false);

  if (!activeClub) return null;
  const name = activeClub.clubName ?? t('club-switcher.unnamed');
  const switchable = clubs.length >= 2;
  if (!switchable && variant === 'pill') return null;
  if (!switchable) {
    return (
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium" numberOfLines={2}>
        {name}
      </Text>
    );
  }

  return (
    <>
      {variant === 'context' ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${t('club-switcher.open')}: ${name}`}
          onPress={() => setOpen(true)}
          hitSlop={{ top: 6, bottom: 6 }}
          className="flex-row items-center self-start"
          style={{ gap: 4, maxWidth: '100%', minHeight: 32 }}
        >
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium flex-shrink" numberOfLines={1}>
            {name}
          </Text>
          <ChevronDown size={16} strokeWidth={1.75} color={themeColors.mutedForeground} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${t('club-switcher.open')}: ${name}`}
          onPress={() => setOpen(true)}
          className="flex-row items-center self-start bg-muted dark:bg-muted-dark rounded-[10px] px-3 py-1.5 min-h-[44px]"
          style={{ gap: 6, maxWidth: '100%' }}
        >
          <Text className="text-foreground dark:text-foreground-dark text-[13px] font-medium flex-shrink" numberOfLines={1}>
            {name}
          </Text>
          <ChevronDown size={16} strokeWidth={1.75} color={themeColors.mutedForeground} />
        </TouchableOpacity>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View accessibilityViewIsModal className="flex-1 justify-end" style={{ backgroundColor: 'rgba(11,12,15,0.48)' }}>
          <Pressable className="flex-1" onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t('ui.cancel')} />
          <SafeAreaView edges={['bottom']} className="bg-card dark:bg-card-dark rounded-t-[20px]" style={{ maxHeight: '70%' }}>
            <View className="items-center pt-2">
              <View className="w-10 h-1 rounded-full bg-border-control dark:bg-border-control-dark" />
            </View>
            <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold px-5 pt-3 pb-2">{t('club-switcher.title')}</Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
              {clubs.map((club) => {
                const selected = club.clubId === activeClub.clubId;
                return (
                  <TouchableOpacity
                    key={club.clubId}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    onPress={() => {
                      setOpen(false);
                      if (selected) return;
                      const proceed = () => setActiveClubId(club.clubId);
                      if (onBeforeSwitch) onBeforeSwitch(proceed);
                      else proceed();
                    }}
                    className={`flex-row items-center justify-between rounded-[14px] px-4 py-3 mb-2 min-h-[52px] ${
                      selected ? 'bg-primary-soft dark:bg-primary-soft-dark' : 'bg-muted dark:bg-muted-dark'
                    }`}
                  >
                    <Text className={`text-[17px] leading-[22px] flex-1 ${selected ? 'text-primary-soft-foreground dark:text-primary-soft-foreground-dark font-semibold' : 'text-foreground dark:text-foreground-dark'}`}>
                      {club.clubName ?? t('club-switcher.unnamed')}
                    </Text>
                    {selected ? <Check size={20} strokeWidth={1.75} color={themeColors.primarySoftForeground} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
