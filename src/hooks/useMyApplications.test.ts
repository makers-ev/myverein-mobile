import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useMyApplications } from './useMyApplications';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const rejected = (id: string, note: string) => ({
  id,
  formVersionId: 'v',
  onBehalfOf: 'self',
  status: 'rejected',
  answers: {},
  files: [],
  submittedAt: null,
  decidedAt: new Date().toISOString(),
  decisionNote: note,
  createdAt: new Date().toISOString(),
  purpose: 'aufnahme',
  version: 1,
  club: { id: 'c', name: 'C', slug: 'demo' },
});

beforeEach(() => apiFetchMock.mockReset());

describe('useMyApplications', () => {
  it('does not call the API while disabled (guest)', async () => {
    const { result } = await renderHook(() => useMyApplications(false));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('loads decided applications with the board message', async () => {
    apiFetchMock.mockResolvedValue({ data: [rejected('r1', 'Leider voll.')] });
    const { result } = await renderHook(() => useMyApplications(true));
    await act(async () => {});
    expect(result.current.phase).toBe('ready');
    expect(result.current.decided[0]?.decisionNote).toBe('Leider voll.');
  });

  it('drops a stale answer when a newer load finished first', async () => {
    let releaseFirst: (v: unknown) => void = () => undefined;
    apiFetchMock
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce({ data: [rejected('new', 'Neu')] });
    const { result } = await renderHook(() => useMyApplications(true));
    await act(async () => {
      await result.current.reload();
    });
    await act(async () => {
      releaseFirst({ data: [rejected('old', 'Alt')] });
    });
    expect(result.current.decided.map((d) => d.id)).toEqual(['new']);
  });

  it('shows an error key when the first load fails', async () => {
    apiFetchMock.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useMyApplications(true));
    await act(async () => {});
    expect(result.current.phase).toBe('error');
    expect(result.current.errorKey).toEqual(expect.any(String));
  });
});
