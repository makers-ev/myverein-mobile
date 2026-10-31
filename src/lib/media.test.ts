import { discardPickerFile, downloadDocumentFile } from './media';

const mockDeleted: string[] = [];
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///app/cache/' } },
  UploadType: { MULTIPART: 1 },
  Directory: class {},
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  },
}));

beforeEach(() => {
  mockDeleted.length = 0;
});

describe('discardPickerFile', () => {
  it('deletes a picker copy in the app cache', () => {
    discardPickerFile('file:///app/cache/ImagePicker/abc.jpg');
    expect(mockDeleted).toEqual(['file:///app/cache/ImagePicker/abc.jpg']);
  });

  it('never touches a file outside the app cache (the user original)', () => {
    discardPickerFile('file:///var/mobile/Media/DCIM/IMG_1.jpg');
    discardPickerFile('content://media/external/images/1');
    expect(mockDeleted).toEqual([]);
  });
});

describe('downloadDocumentFile', () => {
  it('refuses any path outside the document download routes before a request is made', async () => {
    for (const path of ['/media/abc', '/auth/get-session', 'https://evil.example/documents/d1/download?clubId=c1']) {
      const result = await downloadDocumentFile(path, 'Satzung', 'application/pdf');
      expect(result).toMatchObject({ error: { status: 404 } });
    }
  });
});
