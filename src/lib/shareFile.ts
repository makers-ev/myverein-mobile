import * as Sharing from 'expo-sharing';

/**
 * Hands a downloaded file to the system share/open sheet (viewer apps, "Save to Files", mail). Returns `false` when the
 * platform offers no sharing, so the caller can show a message instead of failing silently. The file stays in the app
 * cache; `clearDocumentFileCache()` (lib/media.ts) removes it when the document screen closes.
 */
export async function shareLocalFile(uri: string, mimeType: string, dialogTitle?: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined });
  return true;
}
