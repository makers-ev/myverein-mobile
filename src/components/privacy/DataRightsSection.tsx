import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { daysUntil, isOpenRequest } from '@/lib/privacyCenter';
import { useDataExportSummary, useDataRequests } from '@/hooks/usePrivacyCenter';
import PrivacyCard from './PrivacyCard';

const SECTION_KEYS = ['member_core', 'consents', 'absences', 'guardianship', 'forms_and_applications', 'exit_requests', 'communication', 'account_data'];

/**
 * Own data rights in one club: "Meine Daten ansehen" (Art. 15; a summary per area, the content stays out of the app and
 * the full file is downloaded on the website) and the erasure request with a clear warning and the list of own requests
 * with their deadline. An erasure request erases nothing by itself: the board checks it and has one month to answer.
 */
export default function DataRightsSection({ clubId }: { clubId: string }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const exportData = useDataExportSummary(clubId);
  const { requests, loading, error, reload, saving, requestErasure } = useDataRequests(clubId);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const openErasure = requests.find((r) => r.kind === 'erasure' && isOpenRequest(r));
  const sectionLabel = (key: string) => (SECTION_KEYS.includes(key) ? t(`datenschutz.export.section.${key}`) : t('datenschutz.export.section.other'));
  const day = (iso: string) => new Date(iso).toLocaleDateString(language);

  const confirmErasure = () => {
    Alert.alert(t('datenschutz.erasure.confirm-title'), t('datenschutz.erasure.confirm-message'), [
      { text: t('ui.cancel'), style: 'cancel' },
      {
        text: t('datenschutz.erasure.confirm-action'),
        style: 'destructive',
        onPress: () => {
          setFailure(null);
          setNotice(null);
          void requestErasure().then((res) => {
            if (res.ok) setNotice(t('datenschutz.erasure.sent'));
            else setFailure(apiErrorMessage(res.error, t, 'datenschutz.erasure.error'));
          });
        },
      },
    ]);
  };

  return (
    <>
      <PrivacyCard title={t('datenschutz.export.title')} intro={t('datenschutz.export.intro')}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={exportData.loading}
          onPress={() => void exportData.load()}
          className={`border border-border dark:border-border-dark rounded-xl items-center justify-center ${exportData.loading ? 'opacity-50' : ''}`}
          style={{ minHeight: 48 }}
        >
          {exportData.loading ? <ActivityIndicator color={themeColors.primary} /> : <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm">{t('datenschutz.export.show')}</Text>}
        </TouchableOpacity>
        {exportData.error ? (
          <Text className="text-destructive text-sm mt-2" accessibilityRole="alert">
            {apiErrorMessage(exportData.error, t, 'datenschutz.export.error')}
          </Text>
        ) : null}
        {exportData.summary ? (
          <View className="mt-3">
            {exportData.summary.generatedAt ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-1">{t('datenschutz.export.generated', { date: day(exportData.summary.generatedAt) })}</Text> : null}
            {exportData.summary.sections.length === 0 ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('datenschutz.export.empty')}</Text> : null}
            {exportData.summary.sections.map((s) => (
              <Text key={s.key} className="text-foreground dark:text-foreground-dark text-sm py-0.5">
                {`${sectionLabel(s.key)}: ${s.count}`}
              </Text>
            ))}
            <Text className="text-foreground dark:text-foreground-dark text-sm py-0.5">{t('datenschutz.export.files', { count: exportData.summary.files })}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">{t('datenschutz.export.website')}</Text>
          </View>
        ) : null}
      </PrivacyCard>

      <PrivacyCard title={t('datenschutz.erasure.title')} intro={t('datenschutz.erasure.intro')}>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('datenschutz.erasure.warning')}</Text>
        {openErasure ? null : (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={confirmErasure}
            className={`border border-destructive rounded-xl items-center justify-center ${saving ? 'opacity-50' : ''}`}
            style={{ minHeight: 48 }}
          >
            {saving ? <ActivityIndicator color={themeColors.primary} /> : <Text className="text-destructive font-semibold text-sm">{t('datenschutz.erasure.request')}</Text>}
          </TouchableOpacity>
        )}
        {notice ? (
          <Text className="text-success dark:text-success-dark text-sm mt-2" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
        {failure ? (
          <Text className="text-destructive text-sm mt-2" accessibilityRole="alert">
            {failure}
          </Text>
        ) : null}

        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold mt-4 mb-1">{t('datenschutz.requests.title')}</Text>
        {loading && requests.length === 0 && !error ? (
          <ActivityIndicator color={themeColors.primary} />
        ) : error && requests.length === 0 ? (
          <>
            <Text className="text-destructive text-sm">{apiErrorMessage(error, t, 'datenschutz.requests.error')}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
              <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
            </TouchableOpacity>
          </>
        ) : requests.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('datenschutz.requests.empty')}</Text>
        ) : (
          requests.map((r) => {
            const open = isOpenRequest(r);
            const left = daysUntil(r.dueAt);
            return (
              <View key={r.id} className="border-t border-border dark:border-border-dark py-2">
                <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                  {t(`datenschutz.requests.kind.${r.kind}`)} - {t(`datenschutz.requests.status.${r.status}`)}
                </Text>
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                  {t('datenschutz.requests.received', { date: day(r.receivedAt) })}
                  {open ? ` - ${t('datenschutz.requests.due', { date: day(r.dueAt) })}${left < 0 ? ` (${t('datenschutz.requests.overdue')})` : left <= 7 ? ` (${t('datenschutz.requests.days-left', { count: left })})` : ''}` : r.completedAt ? ` - ${t('datenschutz.requests.completed', { date: day(r.completedAt) })}` : ''}
                </Text>
              </View>
            );
          })
        )}
      </PrivacyCard>
    </>
  );
}
