import React, { useState } from 'react';
import { TextInput } from 'react-native';

import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useInventoryMutations, type InventoryItem, type InventoryItemInput } from '@/hooks/useInventory';
import type { Location } from '@/hooks/useLocations';
import { ChipPicker, conditionLabel, confirmDelete, KNOWN_CONDITIONS, orBlank, useSubmit } from './shared';
import { centsToEuroInput, parseEuroToCents, parsePositiveInt } from './parse';

const NO_LOCATION = '__none__';

interface Props {
  clubId: string;
  /** Edit mode when set, create mode otherwise. */
  item?: InventoryItem | null;
  locations: Location[];
  categories: string[];
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
  onDeleted?: () => void;
}

/** Create/edit sheet for an inventory item; mount it only while open so state starts fresh. */
export default function InventoryItemForm({ clubId, item, locations, categories, onClose, onSaved, onDeleted }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { createItem, updateItem, deleteItem } = useInventoryMutations(clubId);
  const { saving, error, setError, run } = useSubmit();

  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [condition, setCondition] = useState(item?.condition ?? 'gut');
  const [locationId, setLocationId] = useState(item?.locationId ?? NO_LOCATION);
  const [value, setValue] = useState(centsToEuroInput(item?.acquisitionValueCents ?? null));
  const [acquiredAt, setAcquiredAt] = useState(fromDateString(item?.acquiredAt));
  const [lastMaintenanceAt, setLastMaintenanceAt] = useState(fromDateString(item?.lastMaintenanceAt));
  const [interval, setIntervalDays] = useState(item?.maintenanceIntervalDays ? String(item.maintenanceIntervalDays) : '');

  // Free-text condition on the backend: keep an unknown existing value selectable.
  const conditionValues = [...KNOWN_CONDITIONS];
  if (!conditionValues.includes(condition)) conditionValues.push(condition);

  const handleSubmit = () => {
    const cents = parseEuroToCents(value);
    const days = parsePositiveInt(interval);
    if (Number.isNaN(cents) || Number.isNaN(days)) {
      setError(t('material.form.invalid-number'));
      return;
    }
    const blank = item ? null : undefined;
    const input: InventoryItemInput = {
      name: name.trim(),
      condition,
      category: orBlank(category, blank),
      locationId: locationId === NO_LOCATION ? blank : locationId,
      acquisitionValueCents: cents ?? blank,
      acquiredAt: acquiredAt ? toDateString(acquiredAt) : blank,
      lastMaintenanceAt: lastMaintenanceAt ? toDateString(lastMaintenanceAt) : blank,
      maintenanceIntervalDays: days ?? blank,
    };
    void run(async () => {
      const { data } = item ? await updateItem(item.id, input) : await createItem(input);
      onSaved(data);
      onClose();
    });
  };

  const handleDelete = () => {
    if (!item) return;
    confirmDelete(t('material.delete-confirm.title'), t('standorte.delete-confirm.message'), { cancel: t('ui.cancel'), confirm: t('ui.delete') }, () =>
      void run(async () => {
        await deleteItem(item.id);
        onClose();
        onDeleted?.();
      }),
    );
  };

  return (
    <FormSheet
      visible
      title={t(item ? 'material.edit' : 'material.add')}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!name.trim()}
      saving={saving}
      onDelete={item ? handleDelete : undefined}
      error={error}
    >
      <Field label={t('material.form.name')}>
        <TextInput className={inputClassName} value={name} onChangeText={setName} placeholderTextColor={themeColors.mutedForeground} />
      </Field>

      <Field label={t('material.form.category')}>
        <TextInput className={`${inputClassName} mb-2`} value={category} onChangeText={setCategory} />
        {categories.length > 0 && (
          <ChipPicker scroll options={categories.map((c) => ({ value: c, label: c }))} value={category.trim()} onChange={setCategory} />
        )}
      </Field>

      <Field label={t('material.form.condition')}>
        <ChipPicker options={conditionValues.map((c) => ({ value: c, label: conditionLabel(t, c) }))} value={condition} onChange={setCondition} />
      </Field>

      <Field label={t('material.form.location')}>
        <ChipPicker
          scroll
          options={[{ value: NO_LOCATION, label: t('material.form.no-location') }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
          value={locationId}
          onChange={setLocationId}
        />
      </Field>

      <Field label={t('material.form.acquisition-value')}>
        <TextInput
          className={inputClassName}
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={themeColors.mutedForeground}
        />
      </Field>

      <Field label={t('material.form.acquired-at')}>
        <DateTimeField mode="date" value={acquiredAt} onChange={setAcquiredAt} clearable />
      </Field>

      <Field label={t('material.form.last-maintenance-at')}>
        <DateTimeField mode="date" value={lastMaintenanceAt} onChange={setLastMaintenanceAt} clearable />
      </Field>

      <Field label={t('material.form.maintenance-interval')}>
        <TextInput
          className={inputClassName}
          value={interval}
          onChangeText={setIntervalDays}
          keyboardType="number-pad"
          placeholder="365"
          placeholderTextColor={themeColors.mutedForeground}
        />
      </Field>
    </FormSheet>
  );
}
