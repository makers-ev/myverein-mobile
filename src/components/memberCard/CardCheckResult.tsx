import React from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';

import { Button } from '@/components/assembly/ui';
import SignedImage from '@/components/ui/SignedImage';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import type { VerificationPhase } from '@/hooks/useCardVerification';
import type { VerifyResult } from '@/lib/memberCard';

/** Dark fixed backgrounds with white text (>= 6:1) so the result reads outdoors and in dark mode; colour is never the only signal. */
const PANEL: Record<VerifyResult, { bg: string; Icon: typeof CheckCircle2 }> = {
  gueltig: { bg: '#1B5E20', Icon: CheckCircle2 },
  abgelaufen: { bg: '#8A4B00', Icon: AlertTriangle },
  ausgetreten: { bg: '#B71C1C', Icon: XCircle },
  ungueltig: { bg: '#B71C1C', Icon: XCircle },
};

interface Props {
  phase: Extract<VerificationPhase, { kind: 'result' | 'failed' | 'checking' }>;
  onNext: () => void;
  onRetry: () => void;
  canRetry: boolean;
}

/** The big, unambiguous outcome of one check (or the reason none was possible). The next scan needs one tap. */
export default function CardCheckResult({ phase, onNext, onRetry, canRetry }: Props) {
  const { t } = useLanguage();

  if (phase.kind === 'checking') {
    return (
      <View className="flex-1 items-center justify-center p-6" accessibilityLiveRegion="polite">
        <Text className="text-foreground dark:text-foreground-dark text-xl font-bold">{t('check.checking')}</Text>
      </View>
    );
  }

  if (phase.kind === 'failed') {
    const message = phase.reason === 'offline' ? t('check.offline') : phase.reason === 'rate' ? t('check.error.rate') : phase.reason === 'forbidden' ? t('check.error.forbidden') : t('check.error.generic');
    return (
      <View className="flex-1 justify-center p-6">
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" className="text-foreground dark:text-foreground-dark text-2xl font-black mb-6 text-center">
          {message}
        </Text>
        {canRetry ? <Button label={t('check.retry')} onPress={onRetry} /> : null}
        <Button secondary label={t('check.next')} onPress={onNext} />
      </View>
    );
  }

  const { answer, notACard } = phase;
  const { bg, Icon } = PANEL[answer.result];
  const word = t(`check.result.${answer.result}`);
  const member = answer.result === 'gueltig' ? answer.member : undefined;

  return (
    <View className="flex-1" style={{ backgroundColor: bg }}>
      <View className="flex-1 items-center justify-center p-6" accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel={member ? [word, member.displayName, member.category].filter(Boolean).join('. ') : notACard ? `${word}. ${t('check.result.not-card')}` : word}>
        <Icon size={96} color="#FFFFFF" />
        <Text className="font-black text-center mt-4" style={{ color: '#FFFFFF', fontSize: 40, lineHeight: 46 }}>
          {word}
        </Text>
        {notACard ? (
          <Text className="text-center mt-3 text-lg" style={{ color: '#FFFFFF' }}>
            {t('check.result.not-card')}
          </Text>
        ) : null}
        {member ? (
          <View className="items-center mt-6">
            {member.photo?.url ? (
              <SignedImage uri={member.photo.url} style={{ width: 140, height: 175, borderRadius: 12 }} fallback={<NoPhoto text={member.initials} />} />
            ) : (
              <NoPhoto text={member.initials} />
            )}
            <Text className="font-black text-center mt-4" style={{ color: '#FFFFFF', fontSize: 28 }}>
              {member.displayName}
            </Text>
            {member.category ? (
              <Text className="text-center text-lg" style={{ color: '#FFFFFF' }}>
                {member.category}
              </Text>
            ) : null}
            <Text className="text-center mt-2 text-base" style={{ color: '#FFFFFF' }}>
              {member.photo?.url ? t('check.compare') : t('check.no-photo')}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="p-6">
        <Button label={t('check.next')} onPress={onNext} />
      </View>
    </View>
  );
}

function NoPhoto({ text }: { text: string }) {
  return (
    <View className="items-center justify-center" style={{ width: 140, height: 175, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '900' }}>{text}</Text>
    </View>
  );
}
