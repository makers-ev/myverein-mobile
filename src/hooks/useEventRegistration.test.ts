import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import type { FormDefinition } from '@/lib/formSchema';
import { usePublicLinkActions, useRsvpActions } from './useEventRegistration';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const form: FormDefinition = {
  formId: 'f',
  formVersionId: 'v',
  version: 1,
  purpose: 'veranstaltungsanmeldung',
  name: 'x',
  privacyNotice: null,
  childApplication: false,
  fields: [{ key: 'allergy', type: 'text', label: 'Allergien' }],
};

beforeEach(() => apiFetchMock.mockReset());

describe('useRsvpActions', () => {
  it('posts the party size, the answers and the ward', async () => {
    apiFetchMock.mockResolvedValue({ data: { status: 'warteliste', partySize: 3, attendeeId: 'a' } });
    const { result } = await renderHook(() => useRsvpActions('club'));
    let out: { status: string } | undefined;
    await act(async () => {
      out = await result.current.submit('e1', { form, maxCompanions: 3 }, { partySize: 3, answers: { allergy: 'Nüsse' }, forClubMemberId: 'w1' });
    });
    expect(out?.status).toBe('warteliste');
    expect(apiFetchMock).toHaveBeenCalledWith('/events/e1/rsvp?clubId=club&forClubMemberId=w1', {
      method: 'POST',
      body: { partySize: 3, answers: { allergy: 'Nüsse' }, forClubMemberId: 'w1' },
    });
  });

  it('keeps the old body-less POST for a plain sign-up and cancels per subject', async () => {
    apiFetchMock.mockResolvedValue({ data: { status: 'angemeldet', partySize: 1, attendeeId: 'a' } });
    const { result } = await renderHook(() => useRsvpActions('club'));
    await act(async () => {
      await result.current.submit('e1', { form: null, maxCompanions: 0 }, { partySize: 1, answers: {}, forClubMemberId: null });
      await result.current.cancel('e1', 'w1');
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/events/e1/rsvp?clubId=club', { method: 'POST' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/events/e1/rsvp?clubId=club&forClubMemberId=w1', { method: 'DELETE' });
  });
});

describe('usePublicLinkActions', () => {
  it('creates and revokes the guest link of the event', async () => {
    apiFetchMock.mockResolvedValue({ data: { token: 't', url: '/anmeldung/t', active: true } });
    const { result } = await renderHook(() => usePublicLinkActions('club', 'e1'));
    await act(async () => {
      expect((await result.current.create()).url).toBe('/anmeldung/t');
      await result.current.revoke();
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/events/e1/public-link?clubId=club', { method: 'POST' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/events/e1/public-link?clubId=club', { method: 'DELETE' });
  });
});
