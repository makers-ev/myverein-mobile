import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '@/lib/api';
import { clearDocumentFileCache, downloadDocumentFile } from '@/lib/media';
import { shareLocalFile } from '@/lib/shareFile';
import { useDocumentOpen } from './useDocumentOpen';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/media', () => ({ downloadDocumentFile: jest.fn(), clearDocumentFileCache: jest.fn() }));
jest.mock('@/lib/shareFile', () => ({ shareLocalFile: jest.fn() }));
const download = downloadDocumentFile as jest.Mock;
const share = shareLocalFile as jest.Mock;
const clear = clearDocumentFileCache as jest.Mock;

const doc = { id: 'd1', path: '/documents/d1/download?clubId=c1', title: 'Satzung', mimeType: 'application/pdf' };

beforeEach(() => {
  download.mockReset();
  share.mockReset();
  clear.mockReset();
});

describe('useDocumentOpen', () => {
  it('downloads, shares and clears only its own cache folder on unmount', async () => {
    download.mockResolvedValue({ uri: 'file:///cache/document-files/1/Satzung.pdf', mimeType: 'application/pdf' });
    share.mockResolvedValue(true);
    const { result, unmount } = await renderHook(() => useDocumentOpen());
    expect(clear).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.open(doc);
    });
    expect(download).toHaveBeenCalledWith(doc.path, 'Satzung', 'application/pdf', expect.any(AbortSignal), expect.any(String));
    expect(share).toHaveBeenCalledWith('file:///cache/document-files/1/Satzung.pdf', 'application/pdf', 'Satzung');
    expect(result.current.busyId).toBeNull();
    expect(result.current.error).toBeNull();
    await unmount();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledWith(download.mock.calls[0][4]);
  });

  it('exposes a failed download and does not share', async () => {
    const err = new ApiError(404, 'NOT_FOUND', 'x');
    download.mockResolvedValue({ error: err });
    const { result } = await renderHook(() => useDocumentOpen());
    await act(async () => {
      await result.current.open(doc);
    });
    expect(result.current.error).toBe(err);
    expect(share).not.toHaveBeenCalled();
  });

  it('reports a device without sharing support', async () => {
    download.mockResolvedValue({ uri: 'file:///x.pdf', mimeType: 'application/pdf' });
    share.mockResolvedValue(false);
    const { result } = await renderHook(() => useDocumentOpen());
    await act(async () => {
      await result.current.open(doc);
    });
    expect(result.current.unsupported).toBe(true);
  });

  it('ignores a second tap while a download runs', async () => {
    let finish: (v: unknown) => void = () => {};
    download.mockReturnValue(new Promise((r) => (finish = r)));
    share.mockResolvedValue(true);
    const { result } = await renderHook(() => useDocumentOpen());
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.open(doc);
    });
    expect(result.current.busyId).toBe('d1');
    await act(async () => {
      await result.current.open(doc);
    });
    expect(download).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ uri: 'file:///x.pdf', mimeType: 'application/pdf' });
      await first;
    });
    expect(result.current.busyId).toBeNull();
  });
});
