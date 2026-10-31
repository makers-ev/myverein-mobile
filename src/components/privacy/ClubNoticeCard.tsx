import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useClubPrivacyNotice } from '@/hooks/usePrivacyCenter';
import FormSheet from '@/components/ui/FormSheet';
import PrivacyCard from './PrivacyCard';

/**
 * The club's Datenschutzhinweis (information, not a consent): the current version as plain, selectable text. Whatever the
 * club writes is rendered as a `Text`, no markup path.
 */
export default function ClubNoticeCard({ clubId }: { clubId: string }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { notice, loading, error, reload } = useClubPrivacyNotice(clubId);
  const [open, setOpen] = useState(false);

  return (
    <PrivacyCard title={t('datenschutz.notice.title')} intro={t('datenschutz.notice.intro')}>
      {loading && !notice && !error ? (
        <ActivityIndicator color={themeColors.primary} />
      ) : error && !notice ? (
        <>
          <Text className="text-destructive dark:text-destructive-dark text-sm">{apiErrorMessage(error, t, 'datenschutz.notice.error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </>
      ) : !notice ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('datenschutz.notice.none')}</Text>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          className="border border-border dark:border-border-dark rounded-xl items-center justify-center"
          style={{ minHeight: 48 }}
        >
          <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm">
            {t('datenschutz.notice.read', { version: notice.version, date: new Date(notice.publishedAt).toLocaleDateString(language) })}
          </Text>
        </TouchableOpacity>
      )}

      <FormSheet visible={open && !!notice} title={t('datenschutz.notice.title')} onClose={() => setOpen(false)} cancelLabel={t('consent.close')}>
        <ScrollView nestedScrollEnabled style={{ maxHeight: 420 }}>
          <Text selectable className="text-foreground dark:text-foreground-dark text-sm">
            {notice?.body ?? ''}
          </Text>
        </ScrollView>
      </FormSheet>
    </PrivacyCard>
  );
}
