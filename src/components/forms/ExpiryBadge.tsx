import React from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Clock, MinusCircle } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { type CredentialExpiry, expiryLabel } from '@/lib/credentials';
import { useThemeColors } from '@/theme/colors';

/** `YYYY-MM-DD` -> local date text without the UTC shift. */
export function formatCredentialDate(value: string, locale: string): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(locale);
}

/**
 * Expiry status of a credential: icon + text + border, never colour only ("expired", "expires in N days", "valid until ...").
 * The status comes from the server (Berlin day); the app does not recompute it.
 */
export default function ExpiryBadge({ expiry }: { expiry: CredentialExpiry }) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const text = expiryLabel(expiry, t, (v) => formatCredentialDate(v, language));
  const tone = expiry.status === 'expired' ? colors.destructive : expiry.status === 'expiring' ? colors.warning : expiry.status === 'valid' ? colors.success : colors.mutedForeground;
  const Icon = expiry.status === 'expired' ? AlertTriangle : expiry.status === 'expiring' ? Clock : expiry.status === 'valid' ? CheckCircle2 : MinusCircle;
  return (
    <View
      className="self-start flex-row items-center rounded-full border px-2 py-1"
      style={{ gap: 5, borderColor: tone }}
      accessible
      accessibilityLabel={text}
    >
      <Icon size={14} color={tone} />
      <Text className="text-xs font-semibold" style={{ color: tone }}>
        {text}
      </Text>
    </View>
  );
}
