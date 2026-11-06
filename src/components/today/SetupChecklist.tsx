import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Check, ChevronRight, Circle } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import { SETUP_STEPS, setupStepTarget, type TodaySetup } from '@/lib/today';
import DocsLink from '@/components/ui/DocsLink';
import { DOCS_PATHS } from '@/lib/docsUrl';
import BentoTile from '@/components/ui/BentoTile';
import { useThemeColors } from '@/theme/colors';

/**
 * Setup checklist for the founder (Wave 14 N3): logo, departments, calendar, place, members. Shown on Heute until the
 * server reports everything done (it omits `setup` then). Steps that exist only on the website say so instead of
 * pretending a button would work.
 */
export default function SetupChecklist({ setup }: { setup: TodaySetup }) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const steps = SETUP_STEPS.filter((s) => setup.done.includes(s) || setup.open.includes(s));
  const doneCount = steps.filter((s) => setup.done.includes(s)).length;
  return (
    <BentoTile minHeight={120}>
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-base font-semibold mb-1">
        {t('today.setup.title')}
      </Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3" style={{ fontVariant: ['tabular-nums'] }}>
        {t('today.setup.progress', { done: doneCount, total: steps.length })}
      </Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="bg-muted dark:bg-muted-dark rounded-full overflow-hidden mb-2" style={{ height: 4 }}>
        <View className="bg-primary dark:bg-primary-dark rounded-full" style={{ height: 4, width: `${steps.length ? Math.round((doneCount / steps.length) * 100) : 0}%` }} />
      </View>
      {steps.map((step) => {
        const done = setup.done.includes(step);
        const target = setupStepTarget(step);
        const label = t(`today.setup.step.${step}`);
        const status = done ? t('today.setup.done') : target ? null : t('today.setup.web-only');
        return (
          <TouchableOpacity
            key={step}
            disabled={done || !target}
            accessibilityRole={done || !target ? 'text' : 'button'}
            accessibilityLabel={[done ? t('today.setup.done') : null, label, status && !done ? status : null].filter(Boolean).join('. ')}
            onPress={() => target && navigate(target.route, target.tab ? ({ tab: target.tab } as never) : undefined)}
            className="flex-row items-center py-2"
            style={{ minHeight: 44, gap: 10 }}
          >
            <View style={{ width: 20, alignItems: 'center' }}>
              {done ? <Check size={18} strokeWidth={2} color={colors.primary} /> : <Circle size={18} strokeWidth={1.5} color={colors.mutedForeground} />}
            </View>
            <View className="flex-1">
              <Text className={`text-sm ${done ? 'text-muted-foreground dark:text-muted-foreground-dark line-through' : 'text-foreground dark:text-foreground-dark font-medium'}`}>{label}</Text>
              {status && !done ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{status}</Text> : null}
            </View>
            {!done && target ? <ChevronRight size={18} strokeWidth={1.5} color={colors.mutedForeground} /> : null}
          </TouchableOpacity>
        );
      })}
      <DocsLink path={DOCS_PATHS.setup} />
    </BentoTile>
  );
}
