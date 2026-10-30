import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Clock, ExternalLink, Eye, EyeOff, Info, Link2, MapPin, User, Wifi } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { DOCS_PATHS } from '@/lib/docsUrl';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useLocations, useLocationDetail, type Location, type WifiNetwork, type WifiSecurity, type LocationLink } from '@/hooks/useLocations';
import { buildWifiQrPayload } from '@/lib/wifiQr';
import SignedImage from '@/components/ui/SignedImage';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import KeysSection from './KeysSection';
import { LinkForm, LocationForm, WifiForm } from './LocationForms';
import { EmptyState, IconButton, SectionCard, StatusChip } from './shared';

// Signed photo URLs expire; an image error triggers one refetch for fresh URLs, at most once per 10 s.
const PHOTO_REFRESH_MS = 10_000;

// Tinted pin placeholder so a location without a photo still looks intentional.
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

function LocationCard({ location, onPress, onPhotoExpired }: { location: Location; onPress: () => void; onPhotoExpired: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button"
      onPress={onPress}
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl mb-4 overflow-hidden shadow-sm"
    >
      {location.photoUrl ? (
        <SignedImage
          uri={location.photoUrl}
          className="w-full h-36"
          onExpired={onPhotoExpired}
          fallback={<LocationPhotoPlaceholder className="w-full h-36" />}
        />
      ) : (
        <LocationPhotoPlaceholder className="w-full h-36" />
      )}
      <View className="p-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{location.name}</Text>
        {!!location.address && (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm" numberOfLines={1}>
            {location.address}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function LocationList({ clubId, canWrite, onSelect }: { clubId: string; canWrite: boolean; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { locations, loading, refetch } = useLocations(clubId);
  const [creating, setCreating] = useState(false);
  const onPhotoExpired = useThrottledCallback(() => void refetch(), PHOTO_REFRESH_MS);

  if (loading && locations.length === 0) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold uppercase">
          {t('standorte.list.count', { count: locations.length })}
        </Text>
        {canWrite && <IconButton kind="add" label={t('standorte.add')} onPress={() => setCreating(true)} />}
      </View>

      {locations.length === 0 ? (
        <EmptyState icon={<MapPin size={26} color={themeColors.primary} />} text={t('standorte.list.empty')} docsPath={DOCS_PATHS.places} />
      ) : (
        locations.map((loc) => <LocationCard key={loc.id} location={loc} onPress={() => onSelect(loc.id)} onPhotoExpired={onPhotoExpired} />)
      )}

      {creating && <LocationForm clubId={clubId} onClose={() => setCreating(false)} onSaved={() => void refetch()} />}
    </>
  );
}

// Password stays hidden until the member asks; the QR is built from the same value.
function WifiCard({ network, onEdit }: { network: WifiNetwork; onEdit?: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [showQr, setShowQr] = useState(false);
  // Older backends omit `security`: derive it from the password like the server does.
  const security: WifiSecurity = network.security ?? (network.password ? 'wpa' : 'open');
  const qrValue = network.qrPayload || buildWifiQrPayload(network.ssid, network.password, security);

  return (
    <View className="border border-border dark:border-border-dark rounded-xl p-3 mb-3">
      <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
        <Wifi size={16} color={themeColors.primary} />
        <Text className="flex-1 text-foreground dark:text-foreground-dark font-semibold text-sm">{network.label}</Text>
        {onEdit && <IconButton kind="edit" label={t('standorte.wifi.edit')} onPress={onEdit} />}
      </View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">{network.ssid}</Text>
      <View className="flex-row flex-wrap mb-2" style={{ gap: 6 }}>
        <StatusChip label={t(`standorte.wifi.security.${security}`)} tone={security === 'open' ? 'warning' : 'primary'} />
        {onEdit && network.visibleToGuests && <StatusChip label={t('standorte.visible-to-guests')} tone="muted" />}
      </View>

      {showQr ? (
        <View>
          {security !== 'open' && (
            <Text className="text-foreground dark:text-foreground-dark text-xs mb-2">
              {t('standorte.wifi.password')}: {network.password}
            </Text>
          )}
          <View className="items-center bg-white p-3 rounded-lg self-start">
            <QRCode value={qrValue} size={140} color="#000000" backgroundColor="#FFFFFF" />
          </View>
          <TouchableOpacity onPress={() => setShowQr(false)} accessibilityRole="button" hitSlop={8} className="self-start mt-2 flex-row items-center" style={{ gap: 4 }}>
            <EyeOff size={14} color={themeColors.primary} />
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.wifi.hide-qr')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setShowQr(true)} accessibilityRole="button" hitSlop={8} className="self-start flex-row items-center" style={{ gap: 4 }}>
          <Eye size={14} color={themeColors.primary} />
          <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.wifi.show-qr')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function LinkRow({ link, isLast, onEdit }: { link: LocationLink; isLast: boolean; onEdit?: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  return (
    <View className={`flex-row items-center py-2.5 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`} style={{ gap: 8 }}>
      <TouchableOpacity accessibilityRole="button"
        onPress={() => Linking.openURL(link.url).catch((err) => console.error('Error opening URL:', err))}
        className="flex-1 flex-row items-center"
        style={{ gap: 8 }}
      >
        <Link2 size={16} color={themeColors.primary} />
        <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm font-medium">{link.title}</Text>
        <ExternalLink size={16} color={themeColors.mutedForeground} />
      </TouchableOpacity>
      {onEdit && <IconButton kind="edit" label={t('standorte.links.edit')} onPress={onEdit} />}
    </View>
  );
}

function InfoLine({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View className="flex-row py-2" style={{ gap: 10 }}>
      <View className="pt-0.5">{icon}</View>
      <View className="flex-1">
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-0.5">{title}</Text>
        <Text className="text-foreground dark:text-foreground-dark text-sm">{text}</Text>
      </View>
    </View>
  );
}

type Sheet = { kind: 'location' } | { kind: 'wifi'; network?: WifiNetwork } | { kind: 'link'; link?: LocationLink } | null;

function LocationDetail({
  clubId,
  locationId,
  canWrite,
  canSeeKeys,
  onBack,
}: {
  clubId: string;
  locationId: string;
  canWrite: boolean;
  canSeeKeys: boolean;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { location, wifiNetworks, links, loading, error, refetch } = useLocationDetail(clubId, locationId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const closeSheet = () => setSheet(null);
  const reload = () => void refetch();
  const onPhotoExpired = useThrottledCallback(() => void refetch(), PHOTO_REFRESH_MS);

  // Plain Google Maps search URL: opens the default maps app or a browser, no native SDK needed.
  const handleDirections = () => {
    if (!location?.address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
    Linking.openURL(url).catch((err) => console.error('Error opening URL:', err));
  };

  if (loading && !location) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }
  if (!location) {
    return (
      <View className="py-8 items-start">
        <TouchableOpacity onPress={onBack} accessibilityRole="button" hitSlop={8} className="mb-3">
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('standorte.back')}</Text>
        </TouchableOpacity>
        {error && (
          <>
            <Text className="text-destructive dark:text-destructive-dark text-sm mb-2">{t('standorte.detail.error')}</Text>
            <TouchableOpacity onPress={reload} accessibilityRole="button" hitSlop={8}>
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('standorte.keys.retry')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const muted = themeColors.mutedForeground;
  const hasInfo = !!(location.openingHours || location.contactPerson || location.accessNote);

  return (
    <>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" hitSlop={8} className="mb-3 self-start">
        <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('standorte.back')}</Text>
      </TouchableOpacity>

      {error && (
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <Text className="flex-1 text-destructive dark:text-destructive-dark text-xs">{t('standorte.keys.refresh-error')}</Text>
          <TouchableOpacity onPress={reload} accessibilityRole="button" hitSlop={8}>
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.keys.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {location.photoUrl ? (
        <SignedImage
          uri={location.photoUrl}
          className="w-full h-40 rounded-2xl mb-4"
          onExpired={onPhotoExpired}
          fallback={<LocationPhotoPlaceholder className="w-full h-40 rounded-2xl mb-4" />}
        />
      ) : (
        <LocationPhotoPlaceholder className="w-full h-40 rounded-2xl mb-4" />
      )}

      <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
        <Text className="flex-1 text-xl font-black text-foreground dark:text-foreground-dark">{location.name}</Text>
        {canWrite && <IconButton kind="edit" label={t('standorte.edit')} onPress={() => setSheet({ kind: 'location' })} />}
      </View>

      {!!location.address && (
        <SectionCard title={t('standorte.detail.address')}>
          <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">{location.address}</Text>
          <TouchableOpacity accessibilityRole="button"
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

      {hasInfo && (
        <SectionCard title={t('standorte.detail.info')}>
          {!!location.openingHours && (
            <InfoLine icon={<Clock size={16} color={muted} />} title={t('standorte.detail.opening-hours')} text={location.openingHours} />
          )}
          {!!location.contactPerson && (
            <InfoLine icon={<User size={16} color={muted} />} title={t('standorte.detail.contact')} text={location.contactPerson} />
          )}
          {!!location.accessNote && (
            <InfoLine icon={<Info size={16} color={muted} />} title={t('standorte.detail.access-note')} text={location.accessNote} />
          )}
        </SectionCard>
      )}

      {/* Holders and history are access info: the backend only delivers them with locations:write / locations:read_access. */}
      {canSeeKeys && (
        <KeysSection clubId={clubId} locationId={locationId} holders={location.keyHolders} canWrite={canWrite} onChanged={reload} />
      )}

      <SectionCard
        title={t('standorte.detail.wifi')}
        action={canWrite ? <IconButton kind="add" label={t('standorte.wifi.add')} onPress={() => setSheet({ kind: 'wifi' })} /> : undefined}
      >
        {wifiNetworks.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('standorte.detail.wifi.empty')}</Text>
        ) : (
          wifiNetworks.map((n) => (
            <WifiCard key={n.id} network={n} onEdit={canWrite ? () => setSheet({ kind: 'wifi', network: n }) : undefined} />
          ))
        )}
      </SectionCard>

      <SectionCard
        title={t('standorte.detail.links')}
        action={canWrite ? <IconButton kind="add" label={t('standorte.links.add')} onPress={() => setSheet({ kind: 'link' })} /> : undefined}
      >
        {links.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('standorte.detail.links.empty')}</Text>
        ) : (
          links.map((l, i) => (
            <LinkRow
              key={l.id}
              link={l}
              isLast={i === links.length - 1}
              onEdit={canWrite ? () => setSheet({ kind: 'link', link: l }) : undefined}
            />
          ))
        )}
      </SectionCard>

      {sheet?.kind === 'location' && (
        <LocationForm clubId={clubId} location={location} onClose={closeSheet} onSaved={reload} onDeleted={onBack} />
      )}
      {sheet?.kind === 'wifi' && (
        <WifiForm clubId={clubId} locationId={locationId} network={sheet.network} onClose={closeSheet} onSaved={reload} />
      )}
      {sheet?.kind === 'link' && (
        <LinkForm clubId={clubId} locationId={locationId} link={sheet.link} onClose={closeSheet} onSaved={reload} />
      )}
    </>
  );
}

/**
 * Locations info center: address/hours/contact, WiFi (with QR) and links.
 * `locations:write` additionally manages locations, WiFi networks, links and key issue/return;
 * `locations:read_access` shows key holders and history read-only.
 */
export default function OrteTab({ clubId, locationId }: { clubId: string; locationId?: string }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(locationId ?? null);
  // Opened from the search with a place: show its detail, also when the screen is already mounted.
  useEffect(() => {
    if (locationId) setSelectedLocationId(locationId);
  }, [locationId]);
  const { can } = useOwnMembership(clubId);
  const canWrite = can('locations:write');
  const canSeeKeys = canWrite || can('locations:read_access');

  return selectedLocationId ? (
    <LocationDetail clubId={clubId} locationId={selectedLocationId} canWrite={canWrite} canSeeKeys={canSeeKeys} onBack={() => setSelectedLocationId(null)} />
  ) : (
    <LocationList clubId={clubId} canWrite={canWrite} onSelect={setSelectedLocationId} />
  );
}
