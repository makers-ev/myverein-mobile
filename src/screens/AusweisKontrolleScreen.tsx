import React from 'react';
import { Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { Body, Button, Card, Loading } from '@/components/assembly/ui';
import CardCheckResult from '@/components/memberCard/CardCheckResult';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useCardVerification } from '@/hooks/useCardVerification';
import { useOwnMembership } from '@/hooks/useOwnMembership';

/**
 * "Ausweis-Kontrolle" (Wave 13 M7) for people with `member_cards:verify`: scan the QR of a membership card, get one big
 * answer (gültig / ungültig / abgelaufen / ausgetreten) with photo and name to compare. The checks need the network and are
 * never stored on the device. The camera runs only while this screen is focused and no result is shown.
 */
export default function AusweisKontrolleScreen() {
  const { t } = useLanguage();
  const { activeClub, loading: clubLoading } = useActiveClub();
  const clubId = activeClub?.clubId ?? null;
  const { loading: rightsLoading, can } = useOwnMembership(clubId);
  const { phase, onScan, retry, reset, canRetry } = useCardVerification(clubId);
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const allowed = can('member_cards:verify');

  let body: React.ReactNode;
  if (clubLoading || (rightsLoading && !allowed)) {
    body = <Loading />;
  } else if (!clubId) {
    body = (
      <Card>
        <Body muted>{t('check.no-club')}</Body>
      </Card>
    );
  } else if (!allowed) {
    body = (
      <Card>
        <Body muted>{t('check.no-access')}</Body>
      </Card>
    );
  } else if (phase.kind !== 'scanning') {
    body = <CardCheckResult phase={phase} onNext={reset} onRetry={retry} canRetry={canRetry} />;
  } else if (!permission) {
    body = <Loading />;
  } else if (!permission.granted) {
    body = (
      <Card>
        <Body>{t('check.camera.needed')}</Body>
        {permission.canAskAgain ? (
          <Button label={t('check.camera.allow')} onPress={() => void requestPermission()} />
        ) : (
          <>
            <Body muted>{t('check.camera.denied')}</Body>
            <Button label={t('check.camera.settings')} onPress={() => void Linking.openSettings()} />
          </>
        )}
      </Card>
    );
  } else {
    body = (
      <View className="flex-1">
        <View className="flex-1 rounded-2xl overflow-hidden" accessible accessibilityLabel={t('check.scan-hint')}>
          {focused ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              active
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(r) => onScan(r.data)}
              mute
            />
          ) : null}
        </View>
        <Text accessibilityLiveRegion="polite" className="text-foreground dark:text-foreground-dark text-base font-semibold text-center mt-4">
          {t('check.scan-hint')}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs text-center mt-1">{t('check.not-stored')}</Text>
      </View>
    );
  }

  const fullBleed = allowed && phase.kind !== 'scanning';
  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={fullBleed ? ['bottom'] : undefined}>
      {fullBleed ? null : (
        <View className="px-6 pt-4">
          <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-2">
            {t('check.title')}
          </Text>
        </View>
      )}
      <View className={fullBleed ? 'flex-1' : 'flex-1 px-6 pb-6'}>{body}</View>
    </SafeAreaView>
  );
}
