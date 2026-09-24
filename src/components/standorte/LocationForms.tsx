import React, { useState } from 'react';
import { TextInput } from 'react-native';

import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { withScheme } from '@/lib/withScheme';
import {
  useLocationMutations,
  type Location,
  type LocationInput,
  type LocationLink,
  type WifiNetwork,
} from '@/hooks/useLocations';
import { confirmDelete, orBlank, SwitchRow, useSubmit } from './shared';
import { parseCoordinate } from './parse';

function Input(props: React.ComponentProps<typeof TextInput>) {
  const themeColors = useThemeColors();
  return (
    <TextInput
      className={inputClassName}
      placeholderTextColor={themeColors.mutedForeground}
      style={props.multiline ? { minHeight: 72, textAlignVertical: 'top' } : undefined}
      {...props}
    />
  );
}

function useDeleteConfirm() {
  const { t } = useLanguage();
  return (title: string, onConfirm: () => void) =>
    confirmDelete(title, t('standorte.delete-confirm.message'), { cancel: t('ui.cancel'), confirm: t('ui.delete') }, onConfirm);
}

/** Create/edit sheet for a location; mount it only while open. */
export function LocationForm({
  clubId,
  location,
  onClose,
  onSaved,
  onDeleted,
}: {
  clubId: string;
  location?: Location | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useLanguage();
  const { createLocation, updateLocation, deleteLocation } = useLocationMutations(clubId);
  const { saving, error, setError, run } = useSubmit();
  const askDelete = useDeleteConfirm();

  const [name, setName] = useState(location?.name ?? '');
  const [address, setAddress] = useState(location?.address ?? '');
  const [latitude, setLatitude] = useState(location?.latitude ?? '');
  const [longitude, setLongitude] = useState(location?.longitude ?? '');
  const [openingHours, setOpeningHours] = useState(location?.openingHours ?? '');
  const [contactPerson, setContactPerson] = useState(location?.contactPerson ?? '');
  const [accessNote, setAccessNote] = useState(location?.accessNote ?? '');
  const [photoUrl, setPhotoUrl] = useState(location?.photoUrl ?? '');

  const handleSubmit = () => {
    const lat = parseCoordinate(latitude, 90);
    const lng = parseCoordinate(longitude, 180);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError(t('standorte.form.invalid-coordinates'));
      return;
    }
    const blank = location ? null : undefined;
    const photo = orBlank(photoUrl, blank);
    const input: LocationInput = {
      name: name.trim(),
      address: orBlank(address, blank),
      latitude: lat ?? blank,
      longitude: lng ?? blank,
      openingHours: orBlank(openingHours, blank),
      contactPerson: orBlank(contactPerson, blank),
      accessNote: orBlank(accessNote, blank),
      photoUrl: photo ? withScheme(photo) : photo,
    };
    void run(async () => {
      if (location) await updateLocation(location.id, input);
      else await createLocation(input);
      onSaved();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!location) return;
    askDelete(t('standorte.delete-confirm.title'), () =>
      void run(async () => {
        await deleteLocation(location.id);
        onClose();
        onDeleted?.();
      }),
    );
  };

  return (
    <FormSheet
      visible
      title={t(location ? 'standorte.edit' : 'standorte.add')}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!name.trim()}
      saving={saving}
      onDelete={location ? handleDelete : undefined}
      error={error}
    >
      <Field label={t('standorte.form.name')}>
        <Input value={name} onChangeText={setName} />
      </Field>
      <Field label={t('standorte.detail.address')}>
        <Input value={address} onChangeText={setAddress} multiline />
      </Field>
      <Field label={t('standorte.form.latitude')}>
        <Input value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" placeholder="52.5200" />
      </Field>
      <Field label={t('standorte.form.longitude')}>
        <Input value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" placeholder="13.4050" />
      </Field>
      <Field label={t('standorte.detail.opening-hours')}>
        <Input value={openingHours} onChangeText={setOpeningHours} multiline />
      </Field>
      <Field label={t('standorte.detail.contact')}>
        <Input value={contactPerson} onChangeText={setContactPerson} />
      </Field>
      <Field label={t('standorte.detail.access-note')}>
        <Input value={accessNote} onChangeText={setAccessNote} multiline />
      </Field>
      <Field label={t('standorte.form.photo-url')}>
        <Input value={photoUrl} onChangeText={setPhotoUrl} autoCapitalize="none" keyboardType="url" placeholder="https://" />
      </Field>
    </FormSheet>
  );
}

/** Create/edit sheet for a location's WiFi network. */
export function WifiForm({
  clubId,
  locationId,
  network,
  onClose,
  onSaved,
}: {
  clubId: string;
  locationId: string;
  network?: WifiNetwork | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { createWifi, updateWifi, deleteWifi } = useLocationMutations(clubId);
  const { saving, error, run } = useSubmit();
  const askDelete = useDeleteConfirm();

  const [label, setLabel] = useState(network?.label ?? '');
  const [ssid, setSsid] = useState(network?.ssid ?? '');
  const [password, setPassword] = useState(network?.password ?? '');
  const [visibleToGuests, setVisibleToGuests] = useState(network?.visibleToGuests ?? false);

  const handleSubmit = () => {
    const input = { label: label.trim(), ssid: ssid.trim(), password, visibleToGuests };
    void run(async () => {
      if (network) await updateWifi(locationId, network.id, input);
      else await createWifi(locationId, input);
      onSaved();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!network) return;
    askDelete(t('standorte.wifi.delete-confirm'), () =>
      void run(async () => {
        await deleteWifi(locationId, network.id);
        onSaved();
        onClose();
      }),
    );
  };

  return (
    <FormSheet
      visible
      title={t(network ? 'standorte.wifi.edit' : 'standorte.wifi.add')}
      onClose={onClose}
      onSubmit={handleSubmit}
      // Backend requires a non-empty password.
      submitDisabled={!label.trim() || !ssid.trim() || !password}
      saving={saving}
      onDelete={network ? handleDelete : undefined}
      error={error}
    >
      <Field label={t('standorte.wifi.label')}>
        <Input value={label} onChangeText={setLabel} placeholder={t('standorte.wifi.label-placeholder')} />
      </Field>
      <Field label={t('standorte.wifi.ssid')}>
        <Input value={ssid} onChangeText={setSsid} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t('standorte.wifi.password')}>
        <Input value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <SwitchRow label={t('standorte.visible-to-guests')} value={visibleToGuests} onChange={setVisibleToGuests} />
    </FormSheet>
  );
}

/** Create/edit sheet for a location link. */
export function LinkForm({
  clubId,
  locationId,
  link,
  onClose,
  onSaved,
}: {
  clubId: string;
  locationId: string;
  link?: LocationLink | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { createLink, updateLink, deleteLink } = useLocationMutations(clubId);
  const { saving, error, run } = useSubmit();
  const askDelete = useDeleteConfirm();

  const [title, setTitle] = useState(link?.title ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [visibleToGuests, setVisibleToGuests] = useState(link?.visibleToGuests ?? false);

  const handleSubmit = () => {
    const input = { title: title.trim(), url: withScheme(url.trim()), visibleToGuests };
    void run(async () => {
      if (link) await updateLink(locationId, link.id, input);
      else await createLink(locationId, input);
      onSaved();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!link) return;
    askDelete(t('standorte.links.delete-confirm'), () =>
      void run(async () => {
        await deleteLink(locationId, link.id);
        onSaved();
        onClose();
      }),
    );
  };

  return (
    <FormSheet
      visible
      title={t(link ? 'standorte.links.edit' : 'standorte.links.add')}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!title.trim() || !url.trim()}
      saving={saving}
      onDelete={link ? handleDelete : undefined}
      error={error}
    >
      <Field label={t('standorte.links.title')}>
        <Input value={title} onChangeText={setTitle} />
      </Field>
      <Field label={t('standorte.links.url')}>
        <Input value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://" />
      </Field>
      <SwitchRow label={t('standorte.visible-to-guests')} value={visibleToGuests} onChange={setVisibleToGuests} />
    </FormSheet>
  );
}
