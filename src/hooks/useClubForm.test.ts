import { act, renderHook } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import type { FormDefinition } from '@/lib/formSchema';
import { useClubForm } from './useClubForm';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.Mock;

const definition = (name: string, childApplication = false): FormDefinition => ({
  formId: 'f',
  formVersionId: `v-${name}`,
  version: 1,
  purpose: 'aufnahme',
  name,
  privacyNotice: null,
  childApplication,
  fields: [],
});

const mine = (slug: string, status: string, onBehalfOf = 'self', id = `${slug}-${status}`) => ({
  id,
  formVersionId: 'v',
  onBehalfOf,
  status,
  answers: {},
  files: [],
  submittedAt: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: '2026-10-01T10:00:00Z',
  purpose: 'aufnahme',
  version: 1,
  club: { id: 'c', name: 'C', slug },
});

function route(table: Record<string, unknown>) {
  apiFetchMock.mockImplementation((path: string) => {
    const hit = table[path];
    if (hit instanceof Error) return Promise.reject(hit);
    if (hit === undefined) return Promise.reject(new Error(`unexpected ${path}`));
    return Promise.resolve(hit);
  });
}

beforeEach(() => apiFetchMock.mockReset());

describe('useClubForm', () => {
  it('loads the form and resumes the newest draft of the first allowed mode', async () => {
    route({
      '/club-forms/demo/aufnahme': { data: definition('Demo', true) },
      '/form-submissions/mine': { data: [mine('demo', 'draft'), mine('demo', 'submitted', 'guardian')] },
      '/form-submissions/demo-draft': { data: { submission: { id: 'demo-draft' }, form: definition('Demo', true), outdated: false } },
    });
    const { result } = await renderHook(() => useClubForm());
    await act(async () => {
      await result.current.load('demo');
    });
    expect(result.current.phase).toBe('ready');
    expect(result.current.club).toMatchObject({ slug: 'demo', mode: 'self', modes: ['self', 'guardian'] });
    expect(result.current.club?.resume?.submission.id).toBe('demo-draft');
    expect(result.current.club?.submitted).toHaveLength(1);
  });

  it('offers only the child mode after an own pending application and none without childApplication', async () => {
    route({
      '/club-forms/demo/aufnahme': { data: definition('Demo', false) },
      '/form-submissions/mine': { data: [mine('demo', 'submitted')] },
    });
    const { result } = await renderHook(() => useClubForm());
    await act(async () => {
      await result.current.load('demo');
    });
    expect(result.current.club?.mode).toBeNull();
    expect(result.current.club?.modes).toEqual([]);
  });

  it('drops a late answer for an older load (race)', async () => {
    let releaseA: (v: unknown) => void = () => undefined;
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/club-forms/a/aufnahme') return new Promise((resolve) => (releaseA = resolve));
      if (path === '/club-forms/b/aufnahme') return Promise.resolve({ data: definition('B') });
      if (path === '/form-submissions/mine') return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    const { result } = await renderHook(() => useClubForm());
    let first: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      first = result.current.load('a');
    });
    await act(async () => {
      await result.current.load('b');
    });
    await act(async () => {
      releaseA({ data: definition('A') });
      await first;
    });
    expect(result.current.club?.slug).toBe('b');
    expect(result.current.club?.definition.name).toBe('B');
  });

  it('reports an unknown club code with its own text and other failures via the shared mapping', async () => {
    route({ '/club-forms/nope/aufnahme': new ApiError(404, 'NOT_FOUND', 'x'), '/form-submissions/mine': { data: [] } });
    const { result } = await renderHook(() => useClubForm());
    await act(async () => {
      await result.current.load('nope');
    });
    expect(result.current.phase).toBe('slug');
    expect(result.current.loadErrorKey).toBe('forms.apply.notFound');
    route({ '/club-forms/boom/aufnahme': new ApiError(500, 'INTERNAL', 'x'), '/form-submissions/mine': { data: [] } });
    await act(async () => {
      await result.current.load('boom');
    });
    expect(result.current.loadErrorKey).toBe('api.error.server');
  });

  it('keeps the club on screen when a reload fails', async () => {
    route({ '/club-forms/demo/aufnahme': { data: definition('Demo') }, '/form-submissions/mine': { data: [] } });
    const { result } = await renderHook(() => useClubForm());
    await act(async () => {
      await result.current.load('demo');
    });
    route({ '/club-forms/demo/aufnahme': new ApiError(500, 'INTERNAL', 'x'), '/form-submissions/mine': { data: [] } });
    await act(async () => {
      await result.current.load('demo', 'self', true);
    });
    expect(result.current.club?.slug).toBe('demo');
    expect(result.current.refreshFailed).toBe(true);
    expect(result.current.phase).toBe('ready');
  });

  it('skips a draft that is gone (404) but shows any other failure instead of an empty second form', async () => {
    const table = {
      '/club-forms/demo/aufnahme': { data: definition('Demo') },
      '/form-submissions/mine': { data: [mine('demo', 'draft')] },
      '/form-submissions/demo-draft': new ApiError(404, 'NOT_FOUND', 'x'),
    };
    route(table);
    const { result } = await renderHook(() => useClubForm());
    await act(async () => {
      await result.current.load('demo');
    });
    expect(result.current.phase).toBe('ready');
    expect(result.current.club?.resume).toBeUndefined();

    route({ ...table, '/form-submissions/demo-draft': new ApiError(500, 'INTERNAL', 'x') });
    const { result: r2 } = await renderHook(() => useClubForm());
    await act(async () => {
      await r2.current.load('demo');
    });
    expect(r2.current.club).toBeNull();
    expect(r2.current.phase).toBe('slug');
    expect(r2.current.loadErrorKey).toBe('api.error.server');
  });
});
