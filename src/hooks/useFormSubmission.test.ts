import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import type { FormDefinition, Submission } from '@/lib/formSchema';
import { AUTOSAVE_DELAY_MS, useFormSubmission } from './useFormSubmission';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
jest.mock('@/lib/media', () => ({ uploadSubmissionFile: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;

const def = (over: Partial<FormDefinition> = {}): FormDefinition => ({
  formId: 'f1',
  formVersionId: 'v1',
  version: 1,
  purpose: 'aufnahme',
  name: 'Aufnahme',
  privacyNotice: null,
  childApplication: false,
  fields: [
    { key: 'first_name', type: 'text', label: 'Vorname', required: true },
    { key: 'city_field', type: 'text', label: 'Ort' },
    { key: 'agree', type: 'consent', label: 'Einwilligung', required: true },
  ],
  ...over,
});

const submission = (answers: Record<string, unknown>, over: Partial<Submission> = {}): Submission => ({
  id: 's1',
  formVersionId: 'v1',
  onBehalfOf: 'self',
  status: 'draft',
  answers,
  files: [],
  submittedAt: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
});

const callbacks = () => ({ onSubmitted: jest.fn(), onConflict: jest.fn(), onDiscarded: jest.fn() });

const flushTimers = async () => {
  await act(async () => {
    jest.advanceTimersByTime(AUTOSAVE_DELAY_MS + 10);
  });
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  apiFetchMock.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useFormSubmission', () => {
  it('creates the draft lazily with the first answers, then patches only what changed', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: { submission: submission({ first_name: 'Anna' }) } })
      .mockResolvedValueOnce({ data: { submission: submission({ first_name: 'Anna', city_field: 'Bonn' }) } });
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), ...callbacks() }));

    expect(apiFetchMock).not.toHaveBeenCalled();
    await act(async () => result.current.setAnswer('first_name', 'Anna'));
    await act(async () => result.current.setAnswer('first_name', 'Anna'));
    await flushTimers();
    // one debounced create, not one request per keystroke
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenLastCalledWith('/form-submissions', {
      method: 'POST',
      body: { clubSlug: 'demo', formVersionId: 'v1', purpose: 'aufnahme', onBehalfOf: 'self', answers: { first_name: 'Anna' } },
    });
    expect(result.current.hasDraft).toBe(true);

    await act(async () => result.current.setAnswer('city_field', 'Bonn'));
    await flushTimers();
    expect(apiFetchMock).toHaveBeenLastCalledWith('/form-submissions/s1', { method: 'PATCH', body: { answers: { city_field: 'Bonn' } } });
    expect(result.current.saveState).toBe('saved');
  });

  it('never runs two saves at once: a slow save finishes before the next one starts', async () => {
    let releaseFirst: (v: unknown) => void = () => undefined;
    apiFetchMock
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce({ data: { submission: submission({ first_name: 'Anna', city_field: 'Bonn' }) } });
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), ...callbacks() }));

    await act(async () => result.current.setAnswer('first_name', 'Anna'));
    await flushTimers();
    expect(apiFetchMock).toHaveBeenCalledTimes(1); // create in flight
    await act(async () => result.current.setAnswer('city_field', 'Bonn'));
    await flushTimers();
    // the second save is queued behind the first, not sent concurrently
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    await act(async () => releaseFirst({ data: { submission: submission({ first_name: 'Anna' }) } }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenLastCalledWith('/form-submissions/s1', { method: 'PATCH', body: { answers: { city_field: 'Bonn' } } });
  });

  it('does not send a refused answer again and keeps the field error', async () => {
    const fieldError = new ApiError(422, 'UNPROCESSABLE_ENTITY', 'x', { fields: { city_field: 'invalid_value' } });
    apiFetchMock
      .mockRejectedValueOnce(fieldError)
      .mockResolvedValueOnce({ data: { submission: submission({ first_name: 'Anna' }) } });
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), ...callbacks() }));

    await act(async () => result.current.setAnswer('first_name', 'Anna'));
    await act(async () => result.current.setAnswer('city_field', 'Bonn'));
    await flushTimers();
    expect(result.current.errors).toEqual({ city_field: 'invalid_value' });
    // the valid key still went out in the retry
    expect(apiFetchMock).toHaveBeenLastCalledWith('/form-submissions', expect.objectContaining({ body: expect.objectContaining({ answers: { first_name: 'Anna' } }) }));
  });

  it('re-pins a draft on FORM_VERSION_OUTDATED, keeps the answers per key and reports the dropped ones', async () => {
    const next = def({
      formVersionId: 'v2',
      version: 2,
      fields: [
        { key: 'first_name', type: 'text', label: 'Vorname', required: true },
        { key: 'agree', type: 'consent', label: 'Einwilligung', required: true },
      ],
    });
    const outdated = new ApiError(409, 'FORM_VERSION_OUTDATED', 'x', { submissionId: 's1', currentVersion: next });
    apiFetchMock
      .mockRejectedValueOnce(outdated) // PATCH on the stale version
      .mockResolvedValueOnce({ data: { submission: submission({ first_name: 'Anna' }, { formVersionId: 'v2' }), repinned: true, droppedAnswerKeys: ['city_field'] } });
    const resume = { submission: submission({ first_name: 'Anna' }), form: def(), outdated: false };
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), resume, ...callbacks() }));

    await act(async () => result.current.setAnswer('city_field', 'Bonn'));
    await flushTimers();
    expect(apiFetchMock).toHaveBeenLastCalledWith('/form-submissions/s1', { method: 'PATCH', body: { formVersionId: 'v2' } });
    expect(result.current.definition.formVersionId).toBe('v2');
    expect(result.current.answers).toEqual({ first_name: 'Anna' });
    expect(result.current.notice).toEqual({ labels: ['Ort'], version: 2 });
  });

  it('validates on submit without any request and reports the first errors', async () => {
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), ...callbacks() }));
    let found: Record<string, string> = {};
    await act(async () => {
      found = await result.current.submit();
    });
    expect(found).toEqual({ first_name: 'required', agree: 'required' });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.submitErrorKey).toBe('forms.apply.checkEntries');
  });

  it('submits through create + submit and hands the result to the owner', async () => {
    const cb = callbacks();
    apiFetchMock
      .mockResolvedValueOnce({ data: { submission: submission({ first_name: 'Anna', agree: true }) } })
      .mockResolvedValueOnce({ data: { submission: submission({}, { status: 'submitted' }), warnings: ['birth_date_missing'] } });
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), ...cb }));
    await act(async () => result.current.setAnswer('first_name', 'Anna'));
    await act(async () => result.current.setAnswer('agree', true));
    await act(async () => {
      await result.current.submit();
    });
    expect(apiFetchMock).toHaveBeenLastCalledWith('/form-submissions/s1/submit', { method: 'POST', body: {} });
    expect(cb.onSubmitted).toHaveBeenCalledWith({ submission: expect.objectContaining({ status: 'submitted' }), warnings: ['birth_date_missing'] });
  });

  it('routes ALREADY_MEMBER to the owner', async () => {
    const cb = callbacks();
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, 'ALREADY_MEMBER', 'x'));
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), ...cb }));
    await act(async () => result.current.setAnswer('first_name', 'Anna'));
    await flushTimers();
    expect(cb.onConflict).toHaveBeenCalledWith('already_member');
  });

  it('discards the draft on the server and tells the owner', async () => {
    const cb = callbacks();
    apiFetchMock.mockResolvedValueOnce(undefined);
    const resume = { submission: submission({ first_name: 'Anna' }), form: def(), outdated: false };
    const { result } = await renderHook(() => useFormSubmission({ slug: 'demo', mode: 'self', current: def(), resume, ...cb }));
    await act(async () => {
      await result.current.discard();
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/form-submissions/s1', { method: 'DELETE' });
    expect(cb.onDiscarded).toHaveBeenCalled();
  });
});
