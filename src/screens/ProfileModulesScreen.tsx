import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';

import ClubsLoadError from '@/components/verein/ClubsLoadError';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useProfileModules } from '@/hooks/useProfileModules';
import { contentLang, localizedHelpText, localizedLabel } from '@/lib/customFields';
import { audienceKey, canToggleModule, type CatalogModule, groupModules, isCustomized, profileModuleErrorKey } from '@/lib/profileModules';
import { useThemeColors } from '@/theme/colors';

const mutedClass = 'text-muted-foreground dark:text-muted-foreground-dark text-xs';

function Chip({ label, tone = 'muted', locked }: { label: string; tone?: 'muted' | 'primary'; locked?: boolean }) {
  const colors = useThemeColors();
  return (
    <View
      className={`flex-row items-center px-2 py-0.5 rounded-full ${tone === 'primary' ? 'bg-primary/10 dark:bg-primary-dark/10' : 'bg-muted dark:bg-muted-dark'}`}
      style={{ gap: 4 }}
    >
      {locked ? <Lock size={11} color={colors.mutedForeground} /> : null}
      <Text className={`text-xs font-semibold ${tone === 'primary' ? 'text-primary dark:text-primary-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}>{label}</Text>
    </View>
  );
}

function Note({ text }: { text: string }) {
  return (
    <View className="bg-muted dark:bg-muted-dark rounded-xl p-3 mb-2">
      <Text className={mutedClass}>{text}</Text>
    </View>
  );
}

interface CardProps {
  module: CatalogModule;
  name: string;
  description: string;
  helpText: string | null;
  allowed: boolean;
  reason: 'forms' | 'sensitive' | null;
  busy: boolean;
  anyBusy: boolean;
  onToggle: () => void;
}

function ModuleCard({ module: m, name, description, helpText, allowed, reason, busy, anyBusy, onToggle }: CardProps) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const active = m.state === 'active';
  const disabled = !allowed || anyBusy;
  const actionLabel = active ? t('forms.pm.action.deactivate') : m.state === 'archived' ? t('forms.pm.action.reactivate') : t('forms.pm.action.activate');
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">{name}</Text>
      {description ? <Text className={`${mutedClass} mt-0.5`}>{description}</Text> : null}
      {helpText && helpText !== description ? <Text className={`${mutedClass} mt-0.5`}>{helpText}</Text> : null}
      <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
        {m.state !== 'inactive' ? <Chip tone={active ? 'primary' : 'muted'} label={t(active ? 'forms.pm.state.active' : 'forms.pm.state.archived')} /> : null}
        {isCustomized(m) ? <Chip label={t('forms.pm.state.customized')} /> : null}
        <Chip label={t(audienceKey(m))} locked={m.sensitive} />
        <Chip label={t(m.editableBy === 'self' ? 'forms.pm.editable.self' : 'forms.pm.editable.vorstand')} />
      </View>
      {reason ? <Text className={`${mutedClass} mt-2`}>{t(`forms.pm.disabled.${reason}`)}</Text> : null}
      <TouchableOpacity
        onPress={onToggle}
        disabled={disabled}
        className={`mt-3 rounded-xl items-center justify-center ${active ? 'border border-border dark:border-border-dark' : 'bg-primary dark:bg-primary-dark'} ${disabled ? 'opacity-50' : ''}`}
        style={{ minHeight: 44 }}
        accessibilityRole="button"
        accessibilityLabel={t(active ? 'forms.pm.action.deactivateNamed' : 'forms.pm.action.activateNamed', { name })}
        accessibilityState={{ disabled, busy }}
      >
        {busy ? (
          <ActivityIndicator color={active ? colors.primary : colors.primaryForeground} />
        ) : (
          <Text className={`text-sm font-bold ${active ? 'text-destructive dark:text-destructive-dark' : 'text-primary-foreground dark:text-primary-foreground-dark'}`}>{actionLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

/**
 * "Profil-Bausteine": the board (`forms:write`) switches ready-made profile modules on or off for the club
 * (`GET /member-fields/catalog`, `POST .../activate|deactivate`). Deny by default: without `forms:write` only an explanation
 * shows; sensitive modules need `members:read_sensitive` for both directions and are disabled with a reason otherwise. The
 * server decides in the end. Deactivation asks first and says that values are kept. Nothing is persisted.
 */
export default function ProfileModulesScreen() {
  const { t, language } = useLanguage();
  const lang = contentLang(language);
  const colors = useThemeColors();
  const { activeClub, error: clubsError, loading: clubsLoading } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { can, loading: membershipLoading } = useOwnMembership(clubId);
  const allowedToManage = can('forms:write');
  // The catalog is only requested for callers who may use it (the server would answer 403 anyway).
  const { data, failure, loadFailedAfterData, loading, reload, toggle } = useProfileModules(allowedToManage ? clubId : null, lang);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const run = useCallback(
    async (m: CatalogModule, action: 'activate' | 'deactivate') => {
      setBusyId(m.id);
      setResult(null);
      try {
        await toggle(m.id, action);
        setResult({ ok: true, text: t(action === 'deactivate' ? 'forms.pm.done.deactivated' : m.state === 'archived' ? 'forms.pm.done.reactivated' : 'forms.pm.done.activated') });
      } catch (err) {
        setResult({ ok: false, text: t(profileModuleErrorKey(err)) });
      } finally {
        setBusyId(null);
      }
    },
    [toggle, t],
  );

  const onToggle = (m: CatalogModule) => {
    if (m.state !== 'active') {
      void run(m, 'activate');
      return;
    }
    Alert.alert(t('forms.pm.confirm.title', { name: localizedLabel(m, lang) }), t('forms.pm.confirm.message'), [
      { text: t('forms.pm.confirm.cancel'), style: 'cancel' },
      { text: t('forms.pm.action.deactivate'), style: 'destructive', onPress: () => void run(m, 'deactivate') },
    ]);
  };

  const initialLoading = clubsLoading || membershipLoading || (allowedToManage && loading);
  const sections = data ? groupModules(data.groups, data.modules) : [];
  const retryButton = (
    <TouchableOpacity
      onPress={() => void reload()}
      className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
      style={{ minHeight: 44 }}
      accessibilityRole="button"
    >
      <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.retry')}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4 pb-3">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark" accessibilityRole="header">
          {t('forms.pm.title')}
        </Text>
        {data ? <Text className={`${mutedClass} mt-1`}>{t('forms.pm.limit', { used: data.limit.used, max: data.limit.max })}</Text> : null}
      </View>

      {initialLoading ? (
        <View className="flex-1 items-center justify-center" accessibilityLabel={t('forms.pm.loading')}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !allowedToManage || failure === 'forbidden' ? (
        // Defense in depth: the entry point is hidden without the permission, and the backend would 403 anyway.
        <View className="px-6">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('forms.pm.forbidden')}</Text>
        </View>
      ) : failure ? (
        <View className="px-6">
          <Text className="text-destructive dark:text-destructive-dark text-sm mb-2" accessibilityRole="alert">
            {failure === 'rateLimit' ? t('api.error.rate-limit') : t('forms.pm.loadError')}
          </Text>
          {retryButton}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void reload()} tintColor={colors.primary} />}
        >
          <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">{t('forms.pm.intro')}</Text>
          <Note text={t('forms.pm.note.optional')} />
          <Note text={t('forms.pm.note.reminders')} />
          <Note text={t('forms.pm.note.childProtection')} />

          {result ? (
            <Text
              className={`text-sm mt-2 mb-1 ${result.ok ? 'text-success dark:text-success-dark' : 'text-destructive dark:text-destructive-dark'}`}
              accessibilityRole={result.ok ? undefined : 'alert'}
              accessibilityLiveRegion="polite"
            >
              {result.text}
            </Text>
          ) : null}
          {loadFailedAfterData ? (
            <View className="mt-2 mb-1">
              <Text className="text-destructive dark:text-destructive-dark text-sm mb-2" accessibilityRole="alert">
                {t('forms.pm.refreshError')}
              </Text>
              {retryButton}
            </View>
          ) : null}

          {sections.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-4">{t('forms.pm.empty')}</Text>
          ) : (
            sections.map(({ group, modules }) => {
              const activeCount = modules.filter((m) => m.state === 'active').length;
              return (
                <View key={group.id} className="mt-4">
                  <View className="flex-row items-baseline justify-between mb-2" style={{ gap: 8 }}>
                    <Text className="flex-1 text-foreground dark:text-foreground-dark font-bold text-base" accessibilityRole="header">
                      {group.translations?.[lang]?.label ?? group.label}
                    </Text>
                    <Text className={mutedClass}>{t('forms.pm.group.count', { active: activeCount, total: modules.length })}</Text>
                  </View>
                  {modules.map((m) => {
                    const { allowed, reason } = canToggleModule(m, can);
                    return (
                      <ModuleCard
                        key={m.id}
                        module={m}
                        name={localizedLabel(m, lang)}
                        description={m.translations?.[lang]?.description ?? m.description}
                        helpText={localizedHelpText(m, lang)}
                        allowed={allowed}
                        reason={reason}
                        busy={busyId === m.id}
                        anyBusy={busyId !== null}
                        onToggle={() => onToggle(m)}
                      />
                    );
                  })}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
