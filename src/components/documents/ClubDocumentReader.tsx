import React from 'react';
import { Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorRetry, Loading } from '@/components/assembly/ui';
import Markdown from '@/components/ui/Markdown';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useClubInfoPage } from '@/hooks/useClubInfo';
import { useDocumentOpen } from '@/hooks/useDocumentOpen';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { clubInfoAttachmentPath, formatDocumentDate, formatFileSize } from '@/lib/documents';
import { safeHref } from '@/lib/markdown';
import OpenFileNotice from './OpenFileNotice';

interface Props {
  clubId: string;
  /** Slug of the document to read; `null` keeps the reader closed. */
  slug: string | null;
  /** Title from the list, shown while the text loads. */
  title: string;
  onClose: () => void;
}

function Body({ clubId, slug, title }: { clubId: string; slug: string; title: string }) {
  const { t } = useLanguage();
  const { page, loading, error, reload } = useClubInfoPage(clubId, slug);
  const file = useDocumentOpen();

  if (loading && !page) return <Loading />;
  if (!page) return <ErrorRetry message={apiErrorMessage(error, t, 'docs.reader.error')} onRetry={() => void reload()} />;

  const external = page.externalUrl ? safeHref(page.externalUrl) : null;
  const hasText = !!page.contentMarkdown?.trim();
  const attachment = page.attachment;

  return (
    <>
      <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
        {page.validFrom ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('docs.reader.valid-from', { date: formatDocumentDate(page.validFrom) })}</Text>
        ) : null}
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('docs.reader.version', { n: page.currentVersion })}</Text>
      </View>

      {attachment ? (
        <View className="mb-3">
          <Button
            label={file.busyId ? t('docs.open.opening') : t('docs.reader.open-pdf')}
            busy={!!file.busyId}
            accessibilityHint={t('docs.reader.attachment', { size: formatFileSize(attachment.sizeBytes) })}
            onPress={() =>
              void file.open({ id: attachment.documentId, path: clubInfoAttachmentPath(clubId, slug), title: attachment.title || title, mimeType: attachment.mimeType })
            }
          />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('docs.reader.attachment', { size: formatFileSize(attachment.sizeBytes) })}</Text>
          <OpenFileNotice error={file.error} unsupported={file.unsupported} />
        </View>
      ) : null}

      {hasText ? <Markdown source={page.contentMarkdown ?? ''} /> : !attachment && !external ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('docs.reader.empty')}</Text> : null}

      {external ? (
        <Button secondary label={t('docs.reader.external')} accessibilityHint={external} onPress={() => void Linking.openURL(external).catch(() => undefined)} />
      ) : null}
    </>
  );
}

/** Full-screen reader of one club document (Satzung, Hausordnung, ...): sanitised Markdown, PDF attachment, valid-since. Editing stays on the website. */
export default function ClubDocumentReader({ clubId, slug, title, onClose }: Props) {
  const { t } = useLanguage();
  return (
    <Modal visible={!!slug} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center px-5 pt-3 pb-2" style={{ gap: 12 }}>
          <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-xl font-black flex-1">
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('docs.reader.close')} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('docs.reader.close')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 }}>
          {slug ? <Body key={`${clubId}:${slug}`} clubId={clubId} slug={slug} title={title} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
