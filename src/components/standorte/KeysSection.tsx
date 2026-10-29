import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyRound, Undo2 } from 'lucide-react-native';

import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMemberSearch, type ClubMember } from '@/hooks/useClubMembers';
import { useKeyHistory, useLocationMutations, type KeyHistoryEntry, type LocationKeyHolder } from '@/hooks/useLocations';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { eligibleKeyMembers, holderName, keyErrorKey } from './keys';
import { EmptyState, IconButton, SectionCard, StatusChip } from './shared';

const PICKER_LIMIT = 30;

function useKeyAction(action: 'issue' | 'return') {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(t(keyErrorKey(err, action)));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

function TextField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const themeColors = useThemeColors();
  return (
    <Field label={label}>
      <TextInput
        className={inputClassName}
        placeholderTextColor={themeColors.mutedForeground}
        style={props.multiline ? { minHeight: 64, textAlignVertical: 'top' } : undefined}
        {...props}
      />
    </Field>
  );
}

/** Issue sheet: pick a member (accounts, live status), optional key label and note. Mount only while open. */
function IssueKeySheet({
  clubId,
  locationId,
  holders,
  onClose,
  onDone,
}: {
  clubId: string;
  locationId: string;
  holders: LocationKeyHolder[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const { issueKey } = useLocationMutations(clubId);
  const { saving, error, run } = useKeyAction('issue');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ClubMember | null>(null);
  const [keyLabel, setKeyLabel] = useState('');
  const [note, setNote] = useState('');

  // Server-side search (debounced), only while this sheet is mounted.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);
  const search = useMemberSearch(clubId, debounced, true);
  const candidates = eligibleKeyMembers(search.members, holders, query);

  const submit = () => {
    if (!selected?.memberId) return;
    const memberId = selected.memberId;
    void run(async () => {
      await issueKey(locationId, { memberId, keyLabel: keyLabel.trim() || undefined, note: note.trim() || undefined });
    }).then((ok) => {
      if (ok) {
        onDone();
        onClose();
      }
    });
  };

  return (
    <FormSheet
      visible
      title={t('standorte.keys.issue')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('standorte.keys.issue-submit')}
      submitDisabled={!selected}
      saving={saving}
      error={error}
    >
      <Field label={t('standorte.keys.member')}>
        {selected ? (
          <View className="flex-row items-center justify-between">
            <StatusChip label={selected.name ?? '—'} tone="primary" />
            <TouchableOpacity onPress={() => setSelected(null)} accessibilityRole="button" hitSlop={8}>
              <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.keys.change-member')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              className={inputClassName}
              placeholder={t('standorte.keys.search')}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <View className="mt-2">
              {search.error ? (
                <View className="py-2">
                  <Text className="text-destructive dark:text-destructive-dark text-sm mb-1">
                    {t('standorte.keys.search-error')} {apiErrorMessage(search.error, t)}
                  </Text>
                  <TouchableOpacity onPress={() => void search.refetch()} accessibilityRole="button" hitSlop={8} className="self-start">
                    <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.keys.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : search.loading ? (
                <ActivityIndicator className="py-2" />
              ) : candidates.length === 0 ? (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm py-2">{t('standorte.keys.no-candidates')}</Text>
              ) : (
                candidates.slice(0, PICKER_LIMIT).map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setSelected(m)}
                    accessibilityRole="button"
                    className="py-2.5 border-b border-border dark:border-border-dark"
                  >
                    <Text className="text-foreground dark:text-foreground-dark text-sm">{m.name ?? '—'}</Text>
                  </TouchableOpacity>
                ))
              )}
              {search.total > search.members.length || candidates.length > PICKER_LIMIT && (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs pt-2">{t('standorte.keys.narrow-search')}</Text>
              )}
            </View>
          </View>
        )}
      </Field>
      <TextField label={t('standorte.keys.label')} value={keyLabel} onChangeText={setKeyLabel} maxLength={120} placeholder={t('standorte.keys.label-placeholder')} />
      <TextField label={t('standorte.keys.note')} value={note} onChangeText={setNote} maxLength={500} multiline />
    </FormSheet>
  );
}

/** Return sheet with an optional note. Mount only while open. */
function ReturnKeySheet({
  clubId,
  locationId,
  holder,
  name,
  onClose,
  onDone,
}: {
  clubId: string;
  locationId: string;
  holder: LocationKeyHolder;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const { returnKey } = useLocationMutations(clubId);
  const { saving, error, run } = useKeyAction('return');
  const [note, setNote] = useState('');

  const submit = () => {
    void run(async () => {
      await returnKey(locationId, holder.memberId, note.trim() || undefined);
    }).then((ok) => {
      if (ok) {
        onDone();
        onClose();
      }
    });
  };

  return (
    <FormSheet
      visible
      title={t('standorte.keys.return')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('standorte.keys.return-submit')}
      saving={saving}
      error={error}
    >
      <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">
        {holder.keyLabel ? `${name} · ${holder.keyLabel}` : name}
      </Text>
      <TextField label={t('standorte.keys.note')} value={note} onChangeText={setNote} maxLength={500} multiline />
    </FormSheet>
  );
}

function HistoryRow({ entry, isLast }: { entry: KeyHistoryEntry; isLast: boolean }) {
  const { t } = useLanguage();
  const subject = entry.keyLabel ? `${entry.memberName} · ${entry.keyLabel}` : entry.memberName;
  return (
    <View className={`py-2.5 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}>
      <View className="flex-row items-center justify-between mb-1" style={{ gap: 8 }}>
        <StatusChip label={t(`standorte.keys.action.${entry.action}`)} tone={entry.action === 'issued' ? 'primary' : 'muted'} />
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{new Date(entry.createdAt).toLocaleString()}</Text>
      </View>
      <Text className="text-foreground dark:text-foreground-dark text-sm">{subject}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
        {t('standorte.keys.recorded-by', { name: entry.recordedByName })}
      </Text>
      {!!entry.note && <Text className="text-foreground dark:text-foreground-dark text-xs mt-0.5">{entry.note}</Text>}
    </View>
  );
}

/**
 * Key holders + history of a location. Render only for `locations:write` or
 * `locations:read_access` (the backend returns no holders otherwise); `canWrite`
 * additionally shows issue/return. A 403 on the history hides the history card.
 */
export default function KeysSection({
  clubId,
  locationId,
  holders,
  canWrite,
  onChanged,
}: {
  clubId: string;
  locationId: string;
  holders: LocationKeyHolder[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const history = useKeyHistory(clubId, locationId, true);
  const [issuing, setIssuing] = useState(false);
  const [returning, setReturning] = useState<LocationKeyHolder | null>(null);

  const nameOf = (h: LocationKeyHolder) => holderName(h, history.entries) ?? t('standorte.keys.unknown-member');
  const changed = () => {
    onChanged();
    void history.refetch();
  };

  return (
    <>
      <SectionCard
        title={t('standorte.detail.key-holders')}
        action={canWrite ? <IconButton kind="add" label={t('standorte.keys.issue')} onPress={() => setIssuing(true)} /> : undefined}
      >
        {holders.length === 0 ? (
          <EmptyState icon={<KeyRound size={26} color={themeColors.primary} />} text={t('standorte.detail.key-holders.empty')} />
        ) : (
          holders.map((h, i) => (
            <View
              key={h.id}
              className={`flex-row items-center py-2.5 ${i === holders.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}
              style={{ gap: 8 }}
            >
              <KeyRound size={16} color={themeColors.mutedForeground} />
              <View className="flex-1">
                <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">{nameOf(h)}</Text>
                {!!h.keyLabel && <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{h.keyLabel}</Text>}
              </View>
              {canWrite && (
                <TouchableOpacity
                  onPress={() => setReturning(h)}
                  accessibilityRole="button"
                  hitSlop={8}
                  accessibilityLabel={t('standorte.keys.return')}
                  className="flex-row items-center px-3 py-1.5 rounded-full border border-border dark:border-border-dark"
                  style={{ gap: 4 }}
                >
                  <Undo2 size={14} color={themeColors.foreground} />
                  <Text className="text-foreground dark:text-foreground-dark text-xs font-semibold">{t('standorte.keys.return')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </SectionCard>

      {!history.forbidden && (
        <SectionCard title={t('standorte.keys.history')}>
          {history.loading && history.entries.length === 0 ? (
            <ActivityIndicator color={themeColors.primary} />
          ) : history.error && history.entries.length === 0 ? (
            <View>
              <Text className="text-destructive dark:text-destructive-dark text-sm mb-2">{t('standorte.keys.history-error')}</Text>
              <TouchableOpacity onPress={() => void history.refetch()} accessibilityRole="button" hitSlop={8} className="self-start">
                <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.keys.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : history.entries.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('standorte.keys.history-empty')}</Text>
          ) : (
            <>
              {history.entries.map((e, i) => (
                <HistoryRow key={e.id} entry={e} isLast={i === history.entries.length - 1 && !history.hasMore} />
              ))}
              {history.error && <Text className="text-destructive dark:text-destructive-dark text-xs mt-2">{t('standorte.keys.history-error')}</Text>}
              {history.hasMore && (
                <TouchableOpacity onPress={() => void history.loadMore()} disabled={history.loadingMore} accessibilityRole="button" hitSlop={8} className="self-start mt-2">
                  {history.loadingMore ? (
                    <ActivityIndicator color={themeColors.primary} size="small" />
                  ) : (
                    <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('standorte.keys.load-more')}</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </SectionCard>
      )}

      {issuing && (
        <IssueKeySheet
          clubId={clubId}
          locationId={locationId}
          holders={holders}
          onClose={() => setIssuing(false)}
          onDone={changed}
        />
      )}
      {returning && (
        <ReturnKeySheet
          clubId={clubId}
          locationId={locationId}
          holder={returning}
          name={nameOf(returning)}
          onClose={() => setReturning(null)}
          onDone={changed}
        />
      )}
    </>
  );
}
