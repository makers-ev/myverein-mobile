import { act, renderHook, waitFor } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import type { FormDefinition } from '@/lib/formSchema';
import { useExitForm } from './useExitForm';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;

const def = (id: string): FormDefinition => ({ formId: 'f', formVersionId: id, version: 1, purpose: 'austritt', name: 'Austritt', privacyNotice: null, childApplication: false, fields: [] });

beforeEach(() => apiFetchMock.mockReset());

describe('useExitForm', () => {
  it('does not load while disabled and loads when enabled', async () => {
    apiFetchMock.mockResolvedValue({ data: def('v1') });
    const { result, rerender } = await renderHook(({ on }: { on: boolean }) => useExitForm('c1', on), { initialProps: { on: false } });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.definition).toBeNull();
    await rerender({ on: true });
    await waitFor(() => expect(result.current.definition?.formVersionId).toBe('v1'));
    expect(apiFetchMock).toHaveBeenCalledWith('/club-exit-requests/form?clubId=c1');
  });

  it('reports a failed load and recovers on retry; replace swaps the definition', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useExitForm('c1', true));
    await waitFor(() => expect(result.current.error).toBe(true));
    apiFetchMock.mockResolvedValueOnce({ data: def('v1') });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBe(false);
    await act(async () => result.current.replace(def('v2')));
    expect(result.current.definition?.formVersionId).toBe('v2');
  });
});
