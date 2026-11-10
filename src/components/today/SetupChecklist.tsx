import React, { useEffect, useState } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Check, ChevronRight, ChevronUp, Circle, X } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import { SETUP_STEPS, setupStepTarget, type TodaySetup } from '@/lib/today';
import DocsLink from '@/components/ui/DocsLink';
import { DOCS_PATHS } from '@/lib/docsUrl';
import Button from '@/components/ui/Button';
import { useThemeColors } from '@/theme/colors';
import { dismissSetupChecklist, getDismissedSetupClubs } from '@/settings/setupChecklistStorage';

/** From this many done steps on, the checklist is a single progress row (decision D6). */
export const SETUP_COLLAPSE_AT = 4;

function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="bg-muted dark:bg-muted-dark rounded-full overflow-hidden" style={{ height: 4 }}>
      <View className="bg-primary dark:bg-primary-dark rounded-full" style={{ height: 4, width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
    </View>
  );
}

/**
 * Setup checklist for the founder (Wave 14 N3): logo, departments, calendar, place, members. Shown on Heute until the
 * server reports everything done (it omits `setup` then) or the person hides it for this club (stored on the device).
 * Below 4 done steps it is a card with the open steps first; done steps collapse into one muted line (no
 * strikethrough). From 4 done steps on it is a single progress row ("Verein einrichten · 4 von 5", next step) that
 * expands on tap. Steps that exist only on the website say so instead of pretending a button would work.
 */
export default function SetupChecklist({ setup, clubId }: { setup: TodaySetup; clubId: string }) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    void getDismissedSetupClubs().then((ids) => {
      if (alive) setDismissed(ids.includes(clubId));
    });
    return () => {
      alive = false;
    };
  }, [clubId]);

  const steps = SETUP_STEPS.filter((s) => setup.done.includes(s) || setup.open.includes(s));
  const done = steps.filter((s) => setup.done.includes(s));
  const open = steps.filter((s) => !setup.done.includes(s));
  if (dismissed !== false || steps.length === 0) return null;

  const hide = () => {
    setDismissed(true);
    void dismissSetupChecklist(clubId);
  };
  const next = open[0];
  const nextText = next ? t(setupStepTarget(next) ? 'today.setup.next' : 'today.setup.next-web', { step: t(`today.setup.step.${next}`) }) : null;
  const progress = t('today.setup.row', { done: done.length, total: steps.length });
  const collapsed = done.length >= SETUP_COLLAPSE_AT && !expanded;

  if (collapsed) {
    return (
      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[progress, nextText].filter(Boolean).join('. ')}
          accessibilityHint={t('today.setup.show-all')}
          onPress={() => setExpanded(true)}
          className="flex-1 pl-4 py-3"
          style={{ minHeight: 56 }}
        >
          <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px]" style={{ fontVariant: ['tabular-nums'] }}>
            {progress}
          </Text>
          {nextText ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-5 mt-0.5">{nextText}</Text> : null}
          <View className="mt-2 mr-2">
            <ProgressBar done={done.length} total={steps.length} />
          </View>
        </Pressable>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('today.setup.dismiss.label')} onPress={hide} className="items-center justify-center" style={{ width: 48, height: 56 }}>
          <X size={20} strokeWidth={1.75} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] px-4 pt-4 pb-2">
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold">
        {t('today.setup.title')}
      </Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-0.5 mb-3" style={{ fontVariant: ['tabular-nums'] }}>
        {t('today.setup.progress', { done: done.length, total: steps.length })}
      </Text>
      <ProgressBar done={done.length} total={steps.length} />
      <View className="mt-2">
        {open.map((step) => {
          const target = setupStepTarget(step);
          const label = t(`today.setup.step.${step}`);
          return (
            <TouchableOpacity
              key={step}
              disabled={!target}
              accessibilityRole={target ? 'button' : 'text'}
              accessibilityLabel={[label, target ? null : t('today.setup.web-only')].filter(Boolean).join('. ')}
              onPress={() => target && navigate(target.route, target.tab ? ({ tab: target.tab } as never) : undefined)}
              className="flex-row items-center py-2"
              style={{ minHeight: 48, gap: 12 }}
            >
              <Circle size={20} strokeWidth={1.75} color={colors.mutedForeground} />
              <View className="flex-1">
                <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px]">{label}</Text>
                {!target ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]">{t('today.setup.web-only')}</Text> : null}
              </View>
              {target ? <ChevronRight size={20} strokeWidth={1.75} color={colors.mutedForeground} /> : null}
            </TouchableOpacity>
          );
        })}
        {done.length > 0 ? (
          <View accessible className="flex-row items-start py-2" style={{ gap: 12, minHeight: 44 }}>
            <Check size={20} strokeWidth={2} color={colors.success} />
            <Text className="flex-1 text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">
              {t('today.setup.done-list', { steps: done.map((s) => t(`today.setup.step.${s}`)).join(', ') })}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between" style={{ marginRight: -12 }}>
        <DocsLink path={DOCS_PATHS.setup} />
        {done.length >= SETUP_COLLAPSE_AT ? (
          <Button variant="tertiary" size="M" icon={ChevronUp} label={t('today.setup.show-less')} onPress={() => setExpanded(false)} />
        ) : (
          <Button variant="tertiary" size="M" icon={X} label={t('today.setup.dismiss')} onPress={hide} />
        )}
      </View>
    </View>
  );
}
