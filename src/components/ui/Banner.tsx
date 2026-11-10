import React from 'react';
import { Text, View } from 'react-native';
import { CircleAlert, CircleCheck, Info, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';
import Button from './Button';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'offline';

const TONES: Record<BannerTone, { box: string; text: string; Icon: LucideIcon; icon: 'info' | 'success' | 'warning' | 'destructive' | 'mutedForeground' }> = {
  info: { box: 'bg-info-soft dark:bg-info-soft-dark', text: 'text-info dark:text-info-dark', Icon: Info, icon: 'info' },
  success: { box: 'bg-success-soft dark:bg-success-soft-dark', text: 'text-success dark:text-success-dark', Icon: CircleCheck, icon: 'success' },
  warning: { box: 'bg-warning-soft dark:bg-warning-soft-dark', text: 'text-warning dark:text-warning-dark', Icon: TriangleAlert, icon: 'warning' },
  danger: { box: 'bg-destructive-soft dark:bg-destructive-soft-dark', text: 'text-destructive dark:text-destructive-dark', Icon: CircleAlert, icon: 'destructive' },
  offline: { box: 'bg-muted dark:bg-muted-dark', text: 'text-foreground dark:text-foreground-dark', Icon: WifiOff, icon: 'mutedForeground' },
};

interface Props {
  tone?: BannerTone;
  title?: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  /** Announce as an alert (errors, offline); default only for `danger`/`offline`. */
  alert?: boolean;
  /** Replace the tone's default icon (e.g. a lock for "geheime Abstimmung"). */
  icon?: LucideIcon;
}

/**
 * Banner (Figma `Banner`): an inline message on the soft tint of its tone, icon + Label/M title + Body/M text and an
 * optional tertiary action. Tone is never the only cue (icon + words). Radius 14, padding 12/16.
 */
export default function Banner({ tone = 'info', title, body, action, alert, icon }: Props) {
  const c = TONES[tone];
  const Icon = icon ?? c.Icon;
  const colors = useThemeColors();
  const announce = alert ?? (tone === 'danger' || tone === 'offline');
  return (
    <View accessibilityRole={announce ? 'alert' : undefined} className={`rounded-[14px] px-4 py-3 ${c.box}`}>
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <View style={{ marginTop: 1 }}>
          <Icon size={20} strokeWidth={1.75} color={colors[c.icon]} />
        </View>
        <View className="flex-1">
          {title ? <Text className={`text-[15px] leading-5 font-semibold ${c.text}`}>{title}</Text> : null}
          {body ? <Text className={`text-[15px] leading-[22px] ${title ? 'mt-0.5' : ''} text-foreground dark:text-foreground-dark`}>{body}</Text> : null}
        </View>
      </View>
      {action ? (
        <View className="self-start mt-1" style={{ marginLeft: 18 }}>
          <Button variant="tertiary" size="M" label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
