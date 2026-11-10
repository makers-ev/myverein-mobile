import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';
import Avatar from './Avatar';
import Button from './Button';

interface Props {
  /** Person concerned. */
  name: string;
  /** Kind + date under the name ("Kündigung · beantragt am 07.11.2026"). */
  meta?: string;
  /** Tags next to the name (e.g. `Badge` "Ausschluss", "Ohne Konto"). */
  tags?: ReactNode;
  /** The facts that the decision depends on, as label/value rows on the sunken surface. */
  facts: { label: string; value: string }[];
  /** The one primary action, naming the outcome ("Zum 31.03.2027 genehmigen"). */
  primary?: { label: string; onPress: () => void };
  /** The neutral alternative ("Ablehnen" -> a sheet with an optional reason follows). */
  secondary?: { label: string; onPress: () => void };
  /** Set when this person may not decide (own request): no buttons, a lock and this sentence instead. */
  blockedReason?: string | null;
}

/**
 * Decision card (Figma `Decision card`, rule 2): header (avatar, name, kind + date, tags), a facts block on the sunken
 * surface, then ONE primary action that names the outcome plus a neutral "Ablehnen". When the viewer may not decide
 * there are no disabled buttons, only a lock and an explanation. Used for exit requests in Verein > Verwaltung.
 */
export default function DecisionCard({ name, meta, tags, facts, primary, secondary, blockedReason }: Props) {
  const colors = useThemeColors();
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] p-4 mb-3">
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Avatar name={name} size="M" />
        <View className="flex-1">
          <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold">{name}</Text>
          {meta ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-0.5" style={{ fontVariant: ['tabular-nums'] }}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
      {tags ? (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
          {tags}
        </View>
      ) : null}
      {facts.length > 0 ? (
        <View className="bg-muted dark:bg-muted-dark rounded-[10px] px-3 py-2 mt-3">
          {facts.map((f) => (
            <View key={f.label} accessible className="flex-row py-1" style={{ gap: 12 }}>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]" style={{ width: 104 }}>
                {f.label}
              </Text>
              <Text className="flex-1 text-foreground dark:text-foreground-dark text-[15px] leading-[22px]" style={{ fontVariant: ['tabular-nums'] }}>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {blockedReason ? (
        <View accessible className="flex-row items-start mt-3" style={{ gap: 8 }}>
          <View style={{ marginTop: 2 }}>
            <Lock size={18} strokeWidth={1.75} color={colors.mutedForeground} />
          </View>
          <Text className="flex-1 text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{blockedReason}</Text>
        </View>
      ) : primary || secondary ? (
        <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
          {primary ? <Button label={primary.label} onPress={primary.onPress} /> : null}
          {secondary ? <Button variant="secondary" label={secondary.label} onPress={secondary.onPress} /> : null}
        </View>
      ) : null}
    </View>
  );
}
