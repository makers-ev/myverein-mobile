// Pure helpers for the Wave 13 document screens (club documents reader, "Meine Dokumente", archive). Kept free of
// `authClient` so they stay unit-testable (same convention as mediaKey.ts / ward.ts).

import { sanitizeMediaFilename } from './mediaKey';

/**
 * Backend paths the authenticated file download may call. A download sends the session cookie, so the path is built
 * here from ids only and checked again by `isDocumentDownloadPath` -- anything else is refused before a request is made.
 */
export const clubInfoAttachmentPath = (clubId: string, slug: string): string =>
  `/club-info/${encodeURIComponent(slug)}/attachment?clubId=${encodeURIComponent(clubId)}`;

export const archiveDownloadPath = (clubId: string, documentId: string): string =>
  `/documents/${encodeURIComponent(documentId)}/download?clubId=${encodeURIComponent(clubId)}`;

export const memberDocumentDownloadPath = (clubId: string, memberId: string, documentId: string): string =>
  `/member-documents/${encodeURIComponent(memberId)}/${encodeURIComponent(documentId)}/download?clubId=${encodeURIComponent(clubId)}`;

const DOWNLOAD_PATHS = [
  /^\/club-info\/[^/?#]+\/attachment\?clubId=[^&#]+$/,
  /^\/documents\/[^/?#]+\/download\?clubId=[^&#]+$/,
  /^\/member-documents\/[^/?#]+\/[^/?#]+\/download\?clubId=[^&#]+$/,
];

export function isDocumentDownloadPath(path: string): boolean {
  return DOWNLOAD_PATHS.some((re) => re.test(path));
}

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Local file name for a downloaded document: a sanitized stem (the real title/filename may contain spaces or "#", which
 * expo-file-system rejects) plus an extension that matches the MIME type so the viewer app recognises the file.
 */
export function localDocumentFilename(title: string, mimeType: string | null | undefined): string {
  const ext = (mimeType && EXT_BY_MIME[mimeType.toLowerCase()]) || 'bin';
  const stem = sanitizeMediaFilename(title.replace(/\.[A-Za-z0-9]{1,5}$/, '')).replace(/_+/g, '_').replace(/^[._-]+/, '').slice(0, 60);
  return `${stem || 'dokument'}.${ext}`;
}

/** "1,4 MB" / "230 KB" -- one decimal for MB, whole KB, language-neutral digits via the given decimal separator. */
export function formatFileSize(bytes: number | null | undefined, decimal = ','): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', decimal)} MB`;
}

/** `YYYY-MM-DD` (or ISO timestamp) -> `DD.MM.YYYY`; anything else is returned untouched, empty for null. */
export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
}

export interface ArchiveFolder {
  id: string;
  parentId: string | null;
  name: string;
  systemKey: string | null;
  level: 'lesen' | 'schreiben' | 'verwalten';
}

export interface FoldersAnswer {
  data: ArchiveFolder[];
  rootLevel: ArchiveFolder['level'] | null;
  maxDepth: number;
}

/** The archive page opens when the member sees at least one folder or has a root level (UI gating, the backend enforces). */
export function canOpenArchive(answer: Pick<FoldersAnswer, 'data' | 'rootLevel'> | null | undefined): boolean {
  if (!answer) return false;
  return (Array.isArray(answer.data) && answer.data.length > 0) || answer.rootLevel != null;
}

/** Direct children of `parentId` (`null` = roots), sorted by name; a folder whose parent is not readable counts as a root. */
export function childFolders(folders: ArchiveFolder[], parentId: string | null): ArchiveFolder[] {
  const ids = new Set(folders.map((f) => f.id));
  return folders
    .filter((f) => (parentId == null ? f.parentId == null || !ids.has(f.parentId) : f.parentId === parentId))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Breadcrumb from the root down to `folderId`; stops on cycles or unknown parents. */
export function folderTrail(folders: ArchiveFolder[], folderId: string | null): ArchiveFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const trail: ArchiveFolder[] = [];
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && trail.length < 10 && !trail.includes(current)) {
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}
