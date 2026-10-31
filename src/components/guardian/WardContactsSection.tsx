import React from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { telUrl } from '@/lib/ward';
import type { useWardContacts } from '@/hooks/useWardToday';

function Action({ label, url }: { label: string; url: string }) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      className="rounded-xl border border-border dark:border-border-dark items-center justify-center px-4"
      style={{ minHeight: 44 }}
    >
      <Text className="text-primary dark:text-primary-dark font-semibold text-sm">{label}</Text>
    </TouchableOpacity>
  );
}

/** Trainer contacts. Call / mail buttons exist only for the contact ways the backend returned (opened by the trainer). */
export default function WardContactsSection({ contacts }: { contacts: ReturnType<typeof useWardContacts> }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { contacts: rows, loading, error, reload } = contacts;

  return (
    <View className="mb-4">
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-bold text-base mb-2">
        {t('heute.contacts.title')}
      </Text>
      {loading && rows.length === 0 && !error ? (
        <ActivityIndicator color={themeColors.primary} />
      ) : error && rows.length === 0 ? (
        <View>
          <Text className="text-destructive dark:text-destructive-dark text-sm">{t('heute.contacts.error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('heute.contacts.empty')}</Text>
      ) : (
        rows.map((c, i) => (
          <View key={`${c.clubMemberId}-${c.department.id}-${i}`} className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-2">
            <Text className="text-foreground dark:text-foreground-dark text-base font-bold">{c.name}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
              {[t(`heute.role.${c.roleType}`), c.department.name].join(' - ')}
            </Text>
            {c.phone || c.email ? (
              <View className="flex-row mt-2" style={{ gap: 8 }}>
                {c.phone ? <Action label={t('heute.contacts.call')} url={telUrl(c.phone)} /> : null}
                {c.email ? <Action label={t('heute.contacts.mail')} url={`mailto:${c.email}`} /> : null}
              </View>
            ) : (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t('heute.contacts.none-shared')}</Text>
            )}
          </View>
        ))
      )}
    </View>
  );
}
