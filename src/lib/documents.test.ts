import {
  acknowledgementDocumentPath,
  archiveDownloadPath,
  cardPdfPath,
  generationErrorKey,
  jobErrorKey,
  canOpenArchive,
  childFolders,
  clubInfoAttachmentPath,
  folderTrail,
  formatDocumentDate,
  formatFileSize,
  isDocumentDownloadPath,
  localDocumentFilename,
  memberDocumentDownloadPath,
  type ArchiveFolder,
} from './documents';

const f = (id: string, parentId: string | null, name = id): ArchiveFolder => ({ id, parentId, name, systemKey: null, level: 'lesen' });

describe('download paths', () => {
  it('accepts only the three document download routes', () => {
    expect(isDocumentDownloadPath(clubInfoAttachmentPath('c1', 'satzung'))).toBe(true);
    expect(isDocumentDownloadPath(archiveDownloadPath('c1', 'd1'))).toBe(true);
    expect(isDocumentDownloadPath(memberDocumentDownloadPath('c1', 'me', 'd1'))).toBe(true);
    for (const bad of ['/media/abc', '/documents/d1?clubId=c1', '/documents/../x/download?clubId=c1', '/auth/get-session', 'https://evil.example/documents/d1/download?clubId=c1', '/documents/d1/download']) {
      expect(isDocumentDownloadPath(bad)).toBe(false);
    }
  });

  it('encodes ids and refuses anything beyond plain id characters', () => {
    expect(archiveDownloadPath('c 1', 'a/b')).toBe('/documents/a%2Fb/download?clubId=c%201');
    expect(isDocumentDownloadPath(archiveDownloadPath('c 1', 'a/b'))).toBe(false);
    expect(isDocumentDownloadPath(archiveDownloadPath('2f0c-AB_9', 'a1b2'))).toBe(true);
    for (const bad of ['/documents/a.b/download?clubId=c1', '/documents/a1/download?clubId=c1%2F..', '/documents/a1/download?clubId=c1&x=1', '/documents/%2e%2e/download?clubId=c1', '/documents/a1/download?clubId=']) {
      expect(isDocumentDownloadPath(bad)).toBe(false);
    }
  });
});

describe('localDocumentFilename', () => {
  it('sanitizes the stem and sets the extension from the MIME type', () => {
    expect(localDocumentFilename('Satzung 2026 #1.pdf', 'application/pdf')).toBe('Satzung_2026_1.pdf');
    expect(localDocumentFilename('Foto.JPEG', 'image/jpeg')).toBe('Foto.jpg');
    expect(localDocumentFilename('../../etc', 'application/pdf')).toBe('etc.pdf');
    expect(localDocumentFilename('   ', undefined)).toBe('dokument.bin');
  });
});

describe('formatting', () => {
  it('formats sizes and dates', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(230 * 1024)).toBe('230 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(formatFileSize(null)).toBe('');
    expect(formatDocumentDate('2026-10-28T10:00:00Z')).toBe('28.10.2026');
    expect(formatDocumentDate(null)).toBe('');
  });
});

describe('archive folders', () => {
  const folders = [f('a', null, 'Zebra'), f('b', null, 'Alpha'), f('c', 'a'), f('orphan', 'hidden-parent', 'Waise')];

  it('gates the page by folders or root level', () => {
    expect(canOpenArchive({ data: [], rootLevel: null })).toBe(false);
    expect(canOpenArchive({ data: [f('a', null)], rootLevel: null })).toBe(true);
    expect(canOpenArchive({ data: [], rootLevel: 'lesen' })).toBe(true);
    expect(canOpenArchive(null)).toBe(false);
  });

  it('lists roots (incl. orphans) sorted and children of a folder', () => {
    expect(childFolders(folders, null).map((x) => x.id)).toEqual(['b', 'orphan', 'a']);
    expect(childFolders(folders, 'a').map((x) => x.id)).toEqual(['c']);
  });

  it('builds a breadcrumb and survives cycles', () => {
    expect(folderTrail(folders, 'c').map((x) => x.id)).toEqual(['a', 'c']);
    expect(folderTrail([f('x', 'y'), f('y', 'x')], 'x').length).toBeLessThanOrEqual(2);
    expect(folderTrail(folders, null)).toEqual([]);
  });
});

describe('Wave 13 Part B paths and errors', () => {
  it('whitelists the confirmation document and the card pdf only', () => {
    expect(isDocumentDownloadPath(acknowledgementDocumentPath('c1', 'a1'))).toBe(true);
    expect(isDocumentDownloadPath(cardPdfPath('c1', 'me', 'a4'))).toBe(true);
    expect(isDocumentDownloadPath(cardPdfPath('c1', 'w1', 'card'))).toBe(true);
    for (const bad of ['/club-members/me/card?clubId=c1', '/club-members/me/card.pdf?clubId=c1&layout=x', '/acknowledgements/a1?clubId=c1', '/club-members/me/card.pdf?layout=a4&clubId=c1']) {
      expect(isDocumentDownloadPath(bad)).toBe(false);
    }
  });

  it('maps generation errors by machine-readable code', () => {
    expect(generationErrorKey({ details: { code: 'not_a_member_on_date' } })).toBe('confirmation.error.not-member');
    expect(generationErrorKey(new Error('x'))).toBeNull();
    expect(jobErrorKey('quota_exceeded')).toBe('confirmation.error.quota');
    expect(jobErrorKey('render_failed')).toBe('confirmation.error.render');
  });
});
