import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink, Eye, EyeOff, MapPin, Wifi } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { navigate } from '@/navigation/navigationRef';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useLocations, useLocationDetail, type Location, type WifiNetwork, type LocationLink } from '@/hooks/useLocations';
import { buildWifiQrPayload } from '@/lib/wifiQr';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{title}</Text>
      {children}
    </View>
  );
}

// A placeholder for locations without a `photoUrl` -- a large tinted-circle
// pin icon instead of a bare gray box, so an empty photo still looks
// intentional rather than broken.
function LocationPhotoPlaceholder({ className }: { className: string }) {
  const themeColors = useThemeColors();
  return (
    <View className={`items-center justify-center bg-muted dark:bg-muted-dark ${className}`}>
      <View className="w-16 h-16 rounded-full items-center justify-center bg-primary/10 dark:bg-primary-dark/10">
        <MapPin size={28} color={themeColors.primary} />
      </View>
    </View>
  );
}

// The Wave 3 plan explicitly calls out this list as needing to feel
// "visuell einladend statt reiner Datenliste" -- a photo header, name, and
// one-line address preview in a proper card, not a bare text row.
function LocationCard({ location, onPress }: { location: Location; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl mb-4 overflow-hidden shadow-sm"
    >
      {location.photoUrl ? (
        <Image source={{ uri: location.photoUrl }} className="w-full h-36" resizeMode="cover" />
      ) : (
        <LocationPhotoPlaceholder className="w-full h-36" />
      )}
      <View className="p-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{location.name}</Text>
        {location.address && (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm" numberOfLines={1}>
            {location.address}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function LocationList({ clubId, onSelect }: { clubId: string; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { locations, loading } = useLocations(clubId);

  if (loading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  if (locations.length === 0) {
    return <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('standorte.list.empty')}</Text>;
  }

  return <>{locations.map((loc) => <LocationCard key={loc.id} location={loc} onPress={() => onSelect(loc.id)} />)}</>;
}

// Password stays out of any `Text` node until the member explicitly asks
// for it -- tapping "show QR code" reveals both the plaintext password and
// the scannable QR (built from the same value via `buildWifiQrPayload`).
function WifiCard({ network }: { network: WifiNetwork }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [showQr, setShowQr] = useState(false);

  return (
    <View className="border border-border dark:border-border-dark rounded-xl p-3 mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm">{network.label}</Text>
        <Wifi size={16} color={themeColors.mutedForeground} />
      </View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">{network.ssid}</Text>

      {showQr ? (
        <View>
          <Text className="text-foreground dark:text-foreground-dark text-xs mb-2">
            {t('standorte.wifi.password')}: {network.password}
          </Text>
          <View className="items-center bg-white p-3 rounded-lg self-start">
            <QRCode value={buildWifiQrPayload(network.ssid, network.password)} size={140} color="#000000" backgroundColor="#FFFFFF" />
          </View>
          <TouchableOpacity onPress={() => setShowQr(false)} className="self-start mt-2 flex-row items-center" style={{ gap: 4 }}>
            <EyeOff size={14} color={themeColors.primary} />
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.wifi.hide-qr')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setShowQr(true)} className="self-start flex-row items-center" style={{ gap: 4 }}>
          <Eye size={14} color={themeColors.primary} />
          <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.wifi.show-qr')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function LinkRow({ link, isLast }: { link: LocationLink; isLast: boolean }) {
  const themeColors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(link.url).catch((err) => console.error('Error opening URL:', err))}
      className={`flex-row items-center justify-between py-2.5 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}
    >
      <Text className="flex-1 mr-2 text-foreground dark:text-foreground-dark text-sm font-medium">{link.title}</Text>
      <ExternalLink size={16} color={themeColors.mutedForeground} />
    </TouchableOpacity>
  );
}

function LocationDetail({ clubId, locationId, onBack }: { clubId: string; locationId: string; onBack: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { location, wifiNetworks, links, loading } = useLocationDetail(clubId, locationId);

  // Works cross-platform without a native maps SDK -- opens the device's
  // default maps app (or a browser fallback) via a plain Google Maps search
  // URL rather than a `geo:`/`maps:` deep link.
  const handleDirections = () => {
    if (!location?.address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
    Linking.openURL(url).catch((err) => console.error('Error opening URL:', err));
  };

  if (loading || !location) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={onBack} className="mb-3 self-start">
        <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('standorte.back')}</Text>
      </TouchableOpacity>

      {location.photoUrl ? (
        <Image source={{ uri: location.photoUrl }} className="w-full h-40 rounded-2xl mb-4" resizeMode="cover" />
      ) : (
        <LocationPhotoPlaceholder className="w-full h-40 rounded-2xl mb-4" />
      )}

      <Text className="text-xl font-black text-foreground dark:text-foreground-dark mb-4">{location.name}</Text>

      {location.address && (
        <SectionCard title={t('standorte.detail.address')}>
          <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">{location.address}</Text>
          <TouchableOpacity
            onPress={handleDirections}
            className="flex-row items-center self-start bg-primary dark:bg-primary-dark rounded-lg py-2.5 px-4"
            style={{ gap: 6 }}
          >
            <MapPin size={14} color={themeColors.primaryForeground} />
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
              {t('standorte.detail.directions')}
            </Text>
          </TouchableOpacity>
        </SectionCard>
      )}

      {location.openingHours && (
        <SectionCard title={t('standorte.detail.opening-hours')}>
          <Text className="text-foreground dark:text-foreground-dark text-sm">{location.openingHours}</Text>
        </SectionCard>
      )}

      {location.contactPerson && (
        <SectionCard title={t('standorte.detail.contact')}>
          <Text className="text-foreground dark:text-foreground-dark text-sm">{location.contactPerson}</Text>
        </SectionCard>
      )}

      {location.accessNote && (
        <SectionCard title={t('standorte.detail.access-note')}>
          <Text className="text-foreground dark:text-foreground-dark text-sm">{location.accessNote}</Text>
        </SectionCard>
      )}

      {/* Member IDs alone aren't resolvable to names here without an extra
          per-location club-members fetch (an N+1 not worth it for this) --
          a plain count is enough context for a member browsing this screen. */}
      <SectionCard title={t('standorte.detail.key-holders')}>
        {location.keyHolders.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
            {t('standorte.detail.key-holders.empty')}
          </Text>
        ) : (
          <Text className="text-foreground dark:text-foreground-dark text-sm">
            {t('standorte.detail.key-holders.count', { count: location.keyHolders.length })}
          </Text>
        )}
      </SectionCard>

      <SectionCard title={t('standorte.detail.wifi')}>
        {wifiNetworks.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('standorte.detail.wifi.empty')}</Text>
        ) : (
          wifiNetworks.map((n) => <WifiCard key={n.id} network={n} />)
        )}
      </SectionCard>

      <SectionCard title={t('standorte.detail.links')}>
        {links.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('standorte.detail.links.empty')}</Text>
        ) : (
          links.map((l, i) => <LinkRow key={l.id} link={l} isLast={i === links.length - 1} />)
        )}
      </SectionCard>
    </>
  );
}

/**
 * Read-only "info center" for members: browse locations, see
 * address/hours/contact, WiFi (with a scannable QR code), and links.
 * Location/WiFi/link management is board-only and lives on the separate
 * admin website -- entirely out of scope here. Follows `TreffenTab.tsx`'s
 * list<->detail pattern (local `selectedLocationId` state, no dedicated
 * navigator route for the detail view). Deliberately single-purpose for
 * now -- the Material/inventory tab switcher is a separate later task.
 */
export default function StandorteScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { activeClub, loading: clubsLoading } = useMyClubs();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {activeClub?.clubName ?? t('standorte.title')}
        </Text>
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub ? (
        // Same "no club" copy/UX as VereinScreen -- a member with no club
        // shouldn't see a different empty state per screen.
        <View className="px-6 pt-6">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('verein.no-club.title')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{t('verein.no-club.body')}</Text>
          <TouchableOpacity
            className="bg-primary dark:bg-primary-dark rounded-lg py-3 items-center self-start px-5"
            onPress={() => navigate('JoinClub')}
          >
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
              {t('verein.no-club.join')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }}>
          {selectedLocationId ? (
            <LocationDetail clubId={activeClub.clubId} locationId={selectedLocationId} onBack={() => setSelectedLocationId(null)} />
          ) : (
            <LocationList clubId={activeClub.clubId} onSelect={setSelectedLocationId} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
