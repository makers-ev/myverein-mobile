import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Camera, MapPin, Package, Wrench } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import SignedImage from '@/components/ui/SignedImage';
import { isNetworkFailure, isUnknownMediaKey } from '@/lib/memberPhoto';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { useClubSettings } from '@/hooks/useClubSettings';
import { useLocations, type Location } from '@/hooks/useLocations';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import {
  useInventoryItems,
  useInventoryItemDetail,
  useInventoryActions,
  useInventoryMutations,
  type DamageReportStatus,
  type InventoryItem,
  type InventoryLoan,
  type DamageReport,
} from '@/hooks/useInventory';
import { fromDateString } from '@/components/ui/DateTimeField';
import InventoryItemForm from './InventoryItemForm';
import {
  ChipPicker,
  conditionLabel,
  conditionTone,
  EmptyState,
  IconButton,
  SectionCard,
  StatusChip,
  useToneColor,
  type Tone,
} from './shared';

const ALL = '__all__';
const DAMAGE_STATUSES: DamageReportStatus[] = ['gemeldet', 'in_bearbeitung', 'behoben'];
const DAMAGE_TONES: Record<string, Tone> = { gemeldet: 'warning', in_bearbeitung: 'primary', behoben: 'success' };
const LOAN_TONES: Record<string, Tone> = { ausgeliehen: 'primary', ueberfaellig: 'destructive', zurueckgegeben: 'muted' };

function ConditionChip({ condition }: { condition: string }) {
  const { t } = useLanguage();
  return <StatusChip label={conditionLabel(t, condition)} tone={conditionTone(condition)} />;
}

function MaintenanceDueChip() {
  const { t } = useLanguage();
  const color = useToneColor('warning');
  return <StatusChip label={t('material.maintenance-due')} tone="warning" icon={<Wrench size={12} color={color} />} />;
}

function OverdueChip() {
  const { t } = useLanguage();
  const color = useToneColor('destructive');
  return <StatusChip label={t('material.loan-status.ueberfaellig')} tone="destructive" icon={<AlertTriangle size={12} color={color} />} />;
}

function ItemCard({ item, locationName, onPress }: { item: InventoryItem; locationName: string | null; onPress: () => void }) {
  const themeColors = useThemeColors();
  return (
    <TouchableOpacity accessibilityRole="button"
      onPress={onPress}
      className="flex-row bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-3"
      style={{ gap: 12 }}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center bg-primary/10 dark:bg-primary-dark/10">
        <Package size={20} color={themeColors.primary} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
          <Text className="flex-1 text-foreground dark:text-foreground-dark font-bold text-sm">{item.name}</Text>
          <ConditionChip condition={item.condition} />
        </View>
        {!!(item.category || locationName) && (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1" numberOfLines={1}>
            {[item.category, locationName].filter(Boolean).join(' · ')}
          </Text>
        )}
        {item.maintenanceDue && (
          <View className="mt-2">
            <MaintenanceDueChip />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MaterialList({
  items,
  loading,
  locations,
  categories,
  canWrite,
  onAdd,
  onSelect,
}: {
  items: InventoryItem[];
  loading: boolean;
  locations: Location[];
  categories: string[];
  canWrite: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [category, setCategory] = useState(ALL);

  if (loading && items.length === 0) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  const visible = category === ALL ? items : items.filter((i) => i.category === category);
  const locationName = (id: string | null) => (id ? (locations.find((l) => l.id === id)?.name ?? null) : null);

  return (
    <>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold uppercase">
          {t('material.list.count', { count: visible.length })}
        </Text>
        {canWrite && <IconButton kind="add" label={t('material.add')} onPress={onAdd} />}
      </View>

      {categories.length > 0 && (
        <View className="mb-4">
          <ChipPicker
            scroll
            options={[{ value: ALL, label: t('material.filter.all') }, ...categories.map((c) => ({ value: c, label: c }))]}
            value={category}
            onChange={setCategory}
          />
        </View>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={<Package size={26} color={themeColors.primary} />} text={t('material.list.empty')} />
      ) : (
        visible.map((i) => <ItemCard key={i.id} item={i} locationName={locationName(i.locationId)} onPress={() => onSelect(i.id)} />)
      )}
    </>
  );
}

function LoanRow({ loan, isLast }: { loan: InventoryLoan; isLast: boolean }) {
  const { t } = useLanguage();
  return (
    <View className={`py-2.5 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">
          {new Date(loan.borrowedAt).toLocaleDateString()}
        </Text>
        <StatusChip label={t(`material.loan-status.${loan.status}`)} tone={LOAN_TONES[loan.status] ?? 'muted'} />
      </View>
      {!!loan.dueAt && (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {t('material.loans.due-at')}: {new Date(loan.dueAt).toLocaleDateString()}
        </Text>
      )}
      {!!loan.returnedAt && (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {t('material.loans.returned-at')}: {new Date(loan.returnedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
}

// Signed photo URLs expire; an image error triggers one refetch of the detail (fresh URLs), at most once per 10 s.
const PHOTO_REFRESH_MS = 10_000;

function DamageReportPhoto({ photoUrl, onExpired }: { photoUrl: string | null; onExpired: () => void }) {
  if (!photoUrl) return null;
  return <SignedImage uri={photoUrl} className="w-16 h-16 rounded-lg" onExpired={onExpired} />;
}

function DamageReportRow({
  report,
  isLast,
  onPhotoExpired,
  onStatusChange,
}: {
  report: DamageReport;
  isLast: boolean;
  onPhotoExpired: () => void;
  /** Set when the viewer may triage (inventory:write). */
  onStatusChange?: (status: DamageReportStatus) => void;
}) {
  const { t } = useLanguage();
  return (
    <View className={`flex-row py-2.5 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`} style={{ gap: 10 }}>
      <DamageReportPhoto photoUrl={report.photoUrl} onExpired={onPhotoExpired} />
      <View className="flex-1">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-medium mb-1">{report.description}</Text>
        <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
          {!onStatusChange && (
            <StatusChip label={t(`material.damage-status.${report.status}`)} tone={DAMAGE_TONES[report.status] ?? 'muted'} />
          )}
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {new Date(report.createdAt).toLocaleDateString()}
          </Text>
        </View>
        {onStatusChange && (
          <ChipPicker
            options={DAMAGE_STATUSES.map((s) => ({ value: s, label: t(`material.damage-status.${s}`) }))}
            value={report.status as DamageReportStatus}
            onChange={(s) => s !== report.status && onStatusChange(s)}
          />
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5" style={{ gap: 12 }}>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{label}</Text>
      <Text className="flex-1 text-right text-foreground dark:text-foreground-dark text-sm font-medium">{value}</Text>
    </View>
  );
}

function MaterialDetail({
  clubId,
  itemId,
  membershipId,
  canWrite,
  locations,
  categories,
  onBack,
}: {
  clubId: string;
  itemId: string;
  membershipId: string | null;
  canWrite: boolean;
  locations: Location[];
  categories: string[];
  onBack: () => void;
}) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { item, loans, damageReports, loading, refetch } = useInventoryItemDetail(clubId, itemId);
  const { borrow, returnLoan, reportDamage } = useInventoryActions(clubId, itemId, refetch);
  const { setDamageReportStatus } = useInventoryMutations(clubId);

  const [editing, setEditing] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  const [borrowSaving, setBorrowSaving] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);

  const [returningLoanId, setReturningLoanId] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  const [showDamageForm, setShowDamageForm] = useState(false);
  const [description, setDescription] = useState('');
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [damageSaving, setDamageSaving] = useState(false);
  const [damageError, setDamageError] = useState<string | null>(null);
  // Keys only (from `POST /media`); the signed preview URL is not kept.
  const upload = useImageUpload({ clubId, t, onUploaded: (media) => setPhotoKey(media.key) });
  const photoUploading = upload.busy;
  const lostResponse = useRef(false);
  const onPhotoExpired = useThrottledCallback(() => void refetch(), PHOTO_REFRESH_MS);

  // Club switch `allowSelfLoans`; inventory:write holders are exempt. A 403 on borrow also flips it for this session.
  const { settings, refresh: refreshSettings } = useClubSettings(clubId);
  const [borrowForbidden, setBorrowForbidden] = useState(false);
  const selfLoansOff = !canWrite && (settings?.allowSelfLoans === false || borrowForbidden);

  const handleBorrow = async () => {
    setBorrowSaving(true);
    setBorrowError(null);
    try {
      await borrow();
    } catch (err) {
      // The 403 carries no dedicated code, so re-read the club setting: only "switched off" gets the special text.
      const disabled = err instanceof ApiError && err.status === 403 && (await refreshSettings())?.allowSelfLoans === false;
      if (disabled) {
        setBorrowForbidden(true);
        setBorrowError(t('material.loans.self-disabled'));
      } else {
        setBorrowError(apiErrorMessage(err, t));
      }
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
      setReturnError(apiErrorMessage(err, t));
    } finally {
      setReturningLoanId(null);
    }
  };

  const handleTriage = async (reportId: string, status: DamageReportStatus) => {
    setTriageError(null);
    try {
      await setDamageReportStatus(itemId, reportId, status);
      await refetch();
    } catch (err) {
      setTriageError(apiErrorMessage(err, t));
    }
  };

  const handleSubmitDamage = async () => {
    // Blocks while uploading so the report can't drop the photo or attach a stale key later.
    if (!description.trim() || damageSaving || photoUploading) return;
    setDamageSaving(true);
    setDamageError(null);
    try {
      await reportDamage(description.trim(), photoKey ?? undefined);
      lostResponse.current = false;
      setDescription('');
      setPhotoKey(null);
      setShowDamageForm(false);
    } catch (err) {
      if (photoKey && isNetworkFailure(err)) lostResponse.current = true;
      if (photoKey && lostResponse.current && isUnknownMediaKey(err)) {
        // The earlier attempt most likely went through: reload and tell the user instead of "invalid".
        lostResponse.current = false;
        setDescription('');
        setPhotoKey(null);
        setShowDamageForm(false);
        void refetch();
        Alert.alert(t('media.maybe-saved'));
      } else {
        setDamageError(apiErrorMessage(err, t));
      }
    } finally {
      setDamageSaving(false);
    }
  };

  if (loading && !item) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }
  if (!item) return null;

  const locationName = item.locationId ? (locations.find((l) => l.id === item.locationId)?.name ?? null) : null;
  const hasOpenLoan = loans.some((l) => !l.returnedAt);
  const isOverdue = loans.some((l) => l.status === 'ueberfaellig');
  const ownOpenLoan = membershipId ? loans.find((l) => !l.returnedAt && l.memberId === membershipId) : undefined;
  // Date-only columns: parse as local day, not UTC midnight.
  const formatDate = (value: string) => fromDateString(value)?.toLocaleDateString(language) ?? '';

  const infoRows: [string, string][] = [];
  if (item.acquisitionValueCents !== null) {
    infoRows.push([
      t('material.form.acquisition-value-short'),
      (item.acquisitionValueCents / 100).toLocaleString(language, { style: 'currency', currency: 'EUR' }),
    ]);
  }
  if (item.acquiredAt) infoRows.push([t('material.form.acquired-at'), formatDate(item.acquiredAt)]);
  if (item.lastMaintenanceAt) infoRows.push([t('material.form.last-maintenance-at'), formatDate(item.lastMaintenanceAt)]);
  if (item.maintenanceIntervalDays) {
    infoRows.push([t('material.detail.interval'), t('material.detail.interval-days', { count: item.maintenanceIntervalDays })]);
  }
  if (item.maintenanceDueAt) infoRows.push([t('material.detail.next-maintenance'), formatDate(item.maintenanceDueAt)]);

  return (
    <>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} className="mb-3 self-start">
        <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('material.back')}</Text>
      </TouchableOpacity>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <View className="flex-row items-start" style={{ gap: 12 }}>
          <View className="w-12 h-12 rounded-xl items-center justify-center bg-primary/10 dark:bg-primary-dark/10">
            <Package size={24} color={themeColors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-black text-foreground dark:text-foreground-dark">{item.name}</Text>
            {!!item.category && <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{item.category}</Text>}
          </View>
          {canWrite && <IconButton kind="edit" label={t('material.edit')} onPress={() => setEditing(true)} />}
        </View>
        {!!locationName && (
          <View className="flex-row items-center mt-3" style={{ gap: 4 }}>
            <MapPin size={12} color={themeColors.mutedForeground} />
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{locationName}</Text>
          </View>
        )}
        <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
          <ConditionChip condition={item.condition} />
          {item.maintenanceDue && <MaintenanceDueChip />}
          {isOverdue && <OverdueChip />}
        </View>
      </View>

      {infoRows.length > 0 && (
        <SectionCard title={t('material.detail.info')}>
          {infoRows.map(([label, value]) => (
            <InfoRow key={label} label={label} value={value} />
          ))}
        </SectionCard>
      )}

      <SectionCard title={t('material.loans.title')}>
        {loans.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('material.loans.empty')}</Text>
        ) : (
          loans.map((l, i) => <LoanRow key={l.id} loan={l} isLast={i === loans.length - 1} />)
        )}

        {borrowError && !selfLoansOff ? <Text className="text-destructive text-sm mt-3">{borrowError}</Text> : null}
        {returnError ? <Text className="text-destructive text-sm mt-3">{returnError}</Text> : null}

        {ownOpenLoan ? (
          <TouchableOpacity accessibilityRole="button"
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
        ) : !hasOpenLoan && selfLoansOff ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-3">{t('material.loans.self-disabled')}</Text>
        ) : !hasOpenLoan ? (
          <TouchableOpacity accessibilityRole="button"
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
            <DamageReportRow
              key={r.id}
              report={r}
              onPhotoExpired={onPhotoExpired}
              isLast={i === damageReports.length - 1}
              onStatusChange={canWrite ? (s) => void handleTriage(r.id, s) : undefined}
            />
          ))
        )}
        {triageError ? <Text className="text-destructive text-sm mt-2">{triageError}</Text> : null}

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
              <TouchableOpacity accessibilityRole="button"
                className={`flex-row items-center bg-muted dark:bg-muted-dark rounded-lg py-2 px-3 ${photoUploading ? 'opacity-70' : ''}`}
                style={{ gap: 6 }}
                onPress={upload.choose}
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
                <>
                  <Text className="text-success dark:text-success-dark text-xs font-semibold">
                    {t('material.damage-reports.photo-attached')}
                  </Text>
                  <TouchableOpacity onPress={() => setPhotoKey(null)} accessibilityRole="button" hitSlop={8}>
                    <Text className="text-destructive text-xs font-semibold">{t('material.damage-reports.photo-remove')}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            {damageError ?? upload.error ? <Text className="text-destructive text-sm mb-3">{damageError ?? upload.error}</Text> : null}

            <TouchableOpacity accessibilityRole="button"
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
          <TouchableOpacity accessibilityRole="button" className="self-start mt-2" onPress={() => setShowDamageForm(true)}>
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('material.damage-reports.create')}</Text>
          </TouchableOpacity>
        )}
      </SectionCard>

      {editing && (
        <InventoryItemForm
          clubId={clubId}
          item={item}
          locations={locations}
          categories={categories}
          onClose={() => setEditing(false)}
          onSaved={() => void refetch()}
          onDeleted={onBack}
        />
      )}
    </>
  );
}

/**
 * Inventory tab: members browse, borrow/return and report damage;
 * `inventory:write` additionally creates/edits/deletes items and triages damage reports.
 */
export default function MaterialTab({ clubId }: { clubId: string }) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { membership, can } = useOwnMembership(clubId);
  const { locations } = useLocations(clubId);
  const { items, loading, refetch } = useInventoryItems(clubId);
  const canWrite = can('inventory:write');

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  return (
    <>
      {selectedItemId ? (
        <MaterialDetail
          clubId={clubId}
          itemId={selectedItemId}
          membershipId={membership?.memberId ?? null}
          canWrite={canWrite}
          locations={locations}
          categories={categories}
          onBack={() => {
            setSelectedItemId(null);
            void refetch();
          }}
        />
      ) : (
        <MaterialList
          items={items}
          loading={loading}
          locations={locations}
          categories={categories}
          canWrite={canWrite}
          onAdd={() => setCreating(true)}
          onSelect={setSelectedItemId}
        />
      )}
      {creating && (
        <InventoryItemForm
          clubId={clubId}
          locations={locations}
          categories={categories}
          onClose={() => setCreating(false)}
          onSaved={() => void refetch()}
        />
      )}
    </>
  );
}
