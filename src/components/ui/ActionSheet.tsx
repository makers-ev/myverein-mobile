import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import ListRow from './ListRow';
import ListSection from './ListSection';

export interface ActionSheetItem {
  key: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Grouped actions; empty groups are skipped. */
  groups: { title?: string; items: ActionSheetItem[] }[];
}

/**
 * Bottom sheet with a short list of actions (Figma `Bottom sheet`): the overflow menu of a top bar ("..."). Card
 * surface, radius 20, scrim 48 %, Heading/M title, actions as list sections. Tapping an action closes the sheet first and
 * then runs the action (after the slide-out on iOS, so an action that opens another sheet works).
 */
export default function ActionSheet({ visible, title, onClose, groups }: Props) {
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View accessibilityViewIsModal className="flex-1 justify-end" style={{ backgroundColor: 'rgba(11,12,15,0.48)' }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" accessibilityLabel={t('ui.cancel')} />
        <SafeAreaView edges={['bottom']} className="bg-background dark:bg-background-dark rounded-t-[20px]" style={{ maxHeight: '80%' }}>
          <View className="items-center pt-2">
            <View className="w-10 h-1 rounded-full bg-border-control dark:bg-border-control-dark" />
          </View>
          <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold px-5 pt-3 pb-3">
            {title}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            {groups
              .filter((g) => g.items.length > 0)
              .map((g, i) => (
                <ListSection key={g.title ?? i} title={g.title} inset={g.items.some((it) => it.icon) ? 60 : 16}>
                  {g.items.map((it) => (
                    <ListRow
                      key={it.key}
                      icon={it.icon}
                      title={it.label}
                      hint={it.hint}
                      noChevron
                      onPress={() => {
                        onClose();
                        // iOS cannot present the next modal (the sheet this action opens) while this one is still
                        // sliding out, so wait for the dismissal animation there.
                        setTimeout(it.onPress, Platform.OS === 'ios' ? 450 : 0);
                      }}
                    />
                  ))}
                </ListSection>
              ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
