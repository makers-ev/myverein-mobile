import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMyClubs } from '@/hooks/useMyClubs';

/** Club picker (pill + bottom sheet). Renders nothing unless the user belongs to more than one club. */
export default function ClubSwitcher() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { clubs, activeClub, setActiveClubId } = useMyClubs();
  const [open, setOpen] = useState(false);

  if (clubs.length < 2 || !activeClub) return null;

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('club-switcher.open')}
        onPress={() => setOpen(true)}
        className="flex-row items-center self-start bg-muted dark:bg-muted-dark rounded-full px-3 py-1.5 min-h-[36px]"
        style={{ gap: 6 }}
      >
        <Text className="text-foreground dark:text-foreground-dark text-xs font-semibold">{t('club-switcher.switch')}</Text>
        <ChevronDown size={14} color={themeColors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable className="flex-1" onPress={() => setOpen(false)} accessibilityLabel={t('ui.cancel')} />
          <SafeAreaView edges={['bottom']} className="bg-background dark:bg-background-dark rounded-t-3xl" style={{ maxHeight: '70%' }}>
            <View className="items-center pt-2">
              <View className="w-10 h-1 rounded-full bg-border dark:bg-border-dark" />
            </View>
            <Text className="text-foreground dark:text-foreground-dark text-lg font-bold px-5 pt-3 pb-2">{t('club-switcher.title')}</Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
              {clubs.map((club) => {
                const selected = club.clubId === activeClub.clubId;
                return (
                  <TouchableOpacity
                    key={club.clubId}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (!selected) setActiveClubId(club.clubId);
                      setOpen(false);
                    }}
                    className={`flex-row items-center justify-between rounded-2xl p-4 mb-2 min-h-[48px] border ${
                      selected ? 'border-primary dark:border-primary-dark bg-primary/10 dark:bg-primary-dark/10' : 'border-border dark:border-border-dark bg-card dark:bg-card-dark'
                    }`}
                  >
                    <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold flex-1">
                      {club.clubName ?? t('club-switcher.unnamed')}
                    </Text>
                    {selected ? <Check size={18} color={themeColors.primary} /> : null}
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
