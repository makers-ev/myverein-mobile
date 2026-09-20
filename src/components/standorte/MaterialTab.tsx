import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Camera, Wrench } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { uploadMedia, downloadMediaUri } from '@/lib/media';
import { useLocations } from '@/hooks/useLocations';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import {
  useInventoryItems,
  useInventoryItemDetail,
  useInventoryActions,
  damageReportPhotoKey,
  type InventoryItem,
  type InventoryLoan,
  type DamageReport,
} from '@/hooks/useInventory';

interface Props {
  clubId: string;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{title}</Text>
      {children}
    </View>
  );
}

// `condition` is free text on the backend (Freitext-Beispiele: "gut" |
// "beschaedigt" | "defekt", see myverein-backend's inventory schema) --
// same "translate the known examples, fall back to the raw key otherwise"
// convention `VereinScreen.tsx`'s `MemberRow` already uses for `category`.
function ConditionBadge({ condition }: { condition: string }) {
  const { t } = useLanguage();
  return (
    <View className="bg-muted dark:bg-muted-dark px-2.5 py-1 rounded-full self-start">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">
        {t(`material.condition.${condition}`)}
      </Text>
    </View>
  );
}

// `warning` is a fixed token (see theme/colors.ts's `FIXED_COLORS`)
// specifically added for MyVerein's overdue-loan/maintenance-due states.
function MaintenanceDueBadge() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  return (
    <View className="flex-row items-center bg-warning/10 dark:bg-warning-dark/10 px-2.5 py-1 rounded-full self-start" style={{ gap: 4 }}>
      <Wrench size={12} color={themeColors.warning} />
      <Text className="text-warning dark:text-warning-dark text-xs font-semibold">{t('material.maintenance-due')}</Text>
    </View>
  );
}

function LoanStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const overdue = status === 'ueberfaellig';
  return (
    <View
      className={`px-2.5 py-1 rounded-full ${overdue ? 'bg-warning/10 dark:bg-warning-dark/10' : 'bg-primary/10 dark:bg-primary-dark/10'}`}
    >
      <Text className={`text-xs font-semibold ${overdue ? 'text-warning dark:text-warning-dark' : 'text-primary dark:text-primary-dark'}`}>
        {t(`material.loan-status.${status}`)}
      </Text>
    </View>
  );
}

function DamageStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const resolved = status === 'behoben';
  return (
    <View className={`px-2 py-0.5 rounded-full ${resolved ? 'bg-success/20' : 'bg-muted dark:bg-muted-dark'}`}>
      <Text
        className={`text-xs font-semibold ${resolved ? 'text-success dark:text-success-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
      >
        {t(`material.damage-status.${status}`)}
      </Text>
    </View>
  );
}

function ItemCard({ item, onPress }: { item: InventoryItem; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-3"
    >
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <Text className="flex-1 text-foreground dark:text-foreground-dark font-bold text-sm">{item.name}</Text>
        <ConditionBadge condition={item.condition} />
      </View>
      {item.category && (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{item.category}</Text>
      )}
      {item.maintenanceDue && (
        <View className="mt-2">
          <MaintenanceDueBadge />
        </View>
      )}
    </TouchableOpacity>
  );
}

function MaterialList({ clubId, onSelect }: { clubId: string; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { items, loading } = useInventoryItems(clubId);

  if (loading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('material.list.empty')}</Text>;
  }

  return <>{items.map((i) => <ItemCard key={i.id} item={i} onPress={() => onSelect(i.id)} />)}</>;
}

function LoanRow({ loan, isLast }: { loan: InventoryLoan; isLast: boolean }) {
  const { t } = useLanguage();
  return (
    <View className={`py-2.5 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">
          {new Date(loan.borrowedAt).toLocaleDateString()}
        </Text>
        <LoanStatusBadge status={loan.status} />
      </View>
      {loan.dueAt && (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {t('material.loans.due-at')}: {new Date(loan.dueAt).toLocaleDateString()}
        </Text>
      )}
      {loan.returnedAt && (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {t('material.loans.returned-at')}: {new Date(loan.returnedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
}

// Loaded lazily per-row rather than up front for the whole list -- most
// damage reports won't have the detail view open at once, and each photo
// needs its own authenticated round-trip (see media.ts's `downloadMediaUri`).
function DamageReportPhoto({ clubId, photoUrl }: { clubId: string; photoUrl: string | null }) {
  const themeColors = useThemeColors();
  const key = damageReportPhotoKey(photoUrl);
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!key);

  useEffect(() => {
    if (!key) {
      setUri(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void downloadMediaUri(clubId, key).then((resolved) => {
      if (!cancelled) {
        setUri(resolved);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clubId, key]);

  if (loading) {
    return (
      <View className="w-16 h-16 rounded-lg items-center justify-center bg-muted dark:bg-muted-dark">
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }
  if (!uri) return null;
  return <Image source={{ uri }} className="w-16 h-16 rounded-lg" resizeMode="cover" />;
}

function DamageReportRow({ clubId, report, isLast }: { clubId: string; report: DamageReport; isLast: boolean }) {
  return (
    <View className={`flex-row py-2.5 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`} style={{ gap: 10 }}>
      <DamageReportPhoto clubId={clubId} photoUrl={report.photoUrl} />
      <View className="flex-1">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-medium mb-1">{report.description}</Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <DamageStatusBadge status={report.status} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {new Date(report.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MaterialDetail({ clubId, itemId, onBack }: { clubId: string; itemId: string; onBack: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { locations } = useLocations(clubId);
  const { membership } = useOwnMembership(clubId);
  const { item, loans, damageReports, loading, refetch } = useInventoryItemDetail(clubId, itemId);
  const { borrow, returnLoan, reportDamage } = useInventoryActions(clubId, itemId, refetch);

  const [borrowSaving, setBorrowSaving] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);

  const [returningLoanId, setReturningLoanId] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  const [showDamageForm, setShowDamageForm] = useState(false);
  const [description, setDescription] = useState('');
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [damageSaving, setDamageSaving] = useState(false);
  const [damageError, setDamageError] = useState<string | null>(null);
  // Bumped on every pick + every form reset -- a slow upload that resolves
  // after the user already submitted/reset the form must not write its key
  // into whatever form session is active by then (stale-write guard).
  const uploadTokenRef = useRef(0);

  const handleBorrow = async () => {
    setBorrowSaving(true);
    setBorrowError(null);
    try {
      await borrow();
    } catch (err) {
      setBorrowError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setBorrowSaving(false);
    }
  };

  const handleReturn = async (loanId: string) => {
    setReturningLoanId(loanId);
    setReturnError(null);
    try {
      await returnLoan(loanId);
    } catch (err) {
      setReturnError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setReturningLoanId(null);
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    const token = ++uploadTokenRef.current;
    setPhotoUploading(true);
    setDamageError(null);
    const uploadResult = await uploadMedia(clubId, {
      uri: asset.uri,
      name: asset.fileName ?? 'photo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });
    // A stale resolve (the form was reset/resubmitted while this was in
    // flight) must not write into whatever form session is active now.
    if (token !== uploadTokenRef.current) return;
    setPhotoUploading(false);

    if ('error' in uploadResult) {
      setDamageError(t('alert.general-error-description'));
      return;
    }
    setPhotoKey(uploadResult.key);
  };

  const handleSubmitDamage = async () => {
    // Also blocks on photoUploading -- submitting while a photo is still
    // uploading would either silently drop it (report saved with no photo)
    // or, worse, let the upload resolve after the reset and attach a stale
    // key to a later, unrelated report.
    if (!description.trim() || damageSaving || photoUploading) return;
    setDamageSaving(true);
    setDamageError(null);
    try {
      await reportDamage(description.trim(), photoKey ?? undefined);
      uploadTokenRef.current++;
      setDescription('');
      setPhotoKey(null);
      setShowDamageForm(false);
    } catch (err) {
      setDamageError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setDamageSaving(false);
    }
  };

  if (loading || !item) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  // Just a client-side lookup by id against M1's location list -- no new
  // backend join for this, per the task's own explicit call-out.
  const locationName = item.locationId ? locations.find((l) => l.id === item.locationId)?.name ?? null : null;
  const hasOpenLoan = loans.some((l) => !l.returnedAt);
  const ownOpenLoan = membership ? loans.find((l) => !l.returnedAt && l.memberId === membership.id) : undefined;

  return (
    <>
      <TouchableOpacity onPress={onBack} className="mb-3 self-start">
        <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('material.back')}</Text>
      </TouchableOpacity>

      <View className="mb-4">
        <View className="flex-row items-start justify-between mb-1" style={{ gap: 8 }}>
          <Text className="flex-1 text-xl font-black text-foreground dark:text-foreground-dark">{item.name}</Text>
          <ConditionBadge condition={item.condition} />
        </View>
        {item.category && <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-1">{item.category}</Text>}
        {locationName && (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {t('material.detail.location')}: {locationName}
          </Text>
        )}
        {item.maintenanceDue && (
          <View className="mt-2">
            <MaintenanceDueBadge />
          </View>
        )}
      </View>

      <SectionCard title={t('material.loans.title')}>
        {loans.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('material.loans.empty')}</Text>
        ) : (
          loans.map((l, i) => <LoanRow key={l.id} loan={l} isLast={i === loans.length - 1} />)
        )}

        {borrowError ? <Text className="text-destructive text-sm mt-3">{borrowError}</Text> : null}
        {returnError ? <Text className="text-destructive text-sm mt-3">{returnError}</Text> : null}

        {ownOpenLoan ? (
          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center mt-3 ${returningLoanId ? 'opacity-70' : ''}`}
            onPress={() => void handleReturn(ownOpenLoan.id)}
            disabled={!!returningLoanId}
          >
            {returningLoanId ? (
              <ActivityIndicator color={themeColors.primaryForeground} size="small" />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
                {t('material.loans.return')}
              </Text>
            )}
          </TouchableOpacity>
        ) : !hasOpenLoan ? (
          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center mt-3 ${borrowSaving ? 'opacity-70' : ''}`}
            onPress={() => void handleBorrow()}
            disabled={borrowSaving}
          >
            {borrowSaving ? (
              <ActivityIndicator color={themeColors.primaryForeground} size="small" />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
                {t('material.loans.borrow')}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
      </SectionCard>

      <SectionCard title={t('material.damage-reports.title')}>
        {damageReports.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">
            {t('material.damage-reports.empty')}
          </Text>
        ) : (
          damageReports.map((r, i) => (
            <DamageReportRow key={r.id} clubId={clubId} report={r} isLast={i === damageReports.length - 1} />
          ))
        )}

        {showDamageForm ? (
          <View className="mt-3 pt-3 border-t border-border dark:border-border-dark">
            <TextInput
              className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
              placeholder={t('material.damage-reports.description-placeholder')}
              placeholderTextColor={themeColors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
              <TouchableOpacity
                className={`flex-row items-center bg-muted dark:bg-muted-dark rounded-lg py-2 px-3 ${photoUploading ? 'opacity-70' : ''}`}
                style={{ gap: 6 }}
                onPress={() => void handlePickPhoto()}
                disabled={photoUploading}
              >
                <Camera size={14} color={themeColors.foreground} />
                <Text className="text-foreground dark:text-foreground-dark text-xs font-semibold">
                  {t('material.damage-reports.attach-photo')}
                </Text>
              </TouchableOpacity>
              {photoUploading ? (
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <ActivityIndicator size="small" color={themeColors.primary} />
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                    {t('material.damage-reports.uploading')}
                  </Text>
                </View>
              ) : photoKey ? (
                <Text className="text-success dark:text-success-dark text-xs font-semibold">
                  {t('material.damage-reports.photo-attached')}
                </Text>
              ) : null}
            </View>

            {damageError ? <Text className="text-destructive text-sm mb-3">{damageError}</Text> : null}

            <TouchableOpacity
              className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center ${damageSaving || photoUploading ? 'opacity-70' : ''}`}
              onPress={() => void handleSubmitDamage()}
              disabled={damageSaving || photoUploading}
            >
              {damageSaving ? (
                <ActivityIndicator color={themeColors.primaryForeground} size="small" />
              ) : (
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
                  {t('material.damage-reports.submit')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity className="self-start mt-2" onPress={() => setShowDamageForm(true)}>
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('material.damage-reports.create')}</Text>
          </TouchableOpacity>
        )}
      </SectionCard>
    </>
  );
}

/**
 * Self-service inventory tab for members: browse items, borrow one,
 * return one they borrowed, and file a damage report with an optional
 * photo. Item create/edit/delete is board-only and lives on the separate
 * admin website -- entirely out of scope here. Follows `TreffenTab.tsx`'s
 * list<->detail pattern (local `selectedItemId` state).
 */
export default function MaterialTab({ clubId }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  return selectedItemId ? (
    <MaterialDetail clubId={clubId} itemId={selectedItemId} onBack={() => setSelectedItemId(null)} />
  ) : (
    <MaterialList clubId={clubId} onSelect={setSelectedItemId} />
  );
}
