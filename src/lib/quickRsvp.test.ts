jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
import { ApiError } from './api';
import { createSingleFlight, quickRsvp, type QuickRsvpDeps } from './quickRsvp';

const plain = { form: null, maxCompanions: 0, open: true, closedReason: null } as const;
const deps = (over: Partial<QuickRsvpDeps> = {}): QuickRsvpDeps => ({
  fetchRegistration: jest.fn(async () => plain),
  fetchMine: jest.fn(async () => null),
  submit: jest.fn(async () => ({ status: 'angemeldet' as const })),
  ...over,
});
const apiError = (status: number, details?: unknown) => new ApiError(status, 'x', 'x', details);

describe('quickRsvp', () => {
  it('signs up when nothing else is needed', async () => {
    const d = deps();
    expect(await quickRsvp(d)).toEqual({ kind: 'done', status: 'angemeldet' });
    expect(d.submit).toHaveBeenCalledTimes(1);
  });

  it('keeps the waitlist status', async () => {
    expect(await quickRsvp(deps({ submit: async () => ({ status: 'warteliste' }) }))).toEqual({ kind: 'done', status: 'warteliste' });
  });

  it('never overwrites an existing sign-up', async () => {
    const d = deps({ fetchMine: async () => ({ status: 'angemeldet' }) });
    expect(await quickRsvp(d)).toEqual({ kind: 'already', status: 'angemeldet' });
    expect(d.submit).not.toHaveBeenCalled();
  });

  it('opens the sheet for events with companions or a form before posting', async () => {
    const d = deps({ fetchRegistration: async () => ({ ...plain, maxCompanions: 2 }) });
    expect(await quickRsvp(d)).toEqual({ kind: 'details' });
    expect(d.submit).not.toHaveBeenCalled();
  });

  it('a required-field 422 falls back to the sheet', async () => {
    const d = deps({ submit: async () => { throw apiError(422, { fields: { name: 'required' } }); } });
    expect(await quickRsvp(d)).toEqual({ kind: 'details' });
  });

  it('any other failure is an error message, not a navigation', async () => {
    const left = deps({ submit: async () => { throw apiError(422, { code: 'invalid_party_size' }); } });
    expect(await quickRsvp(left)).toEqual({ kind: 'error', errorKey: 'reg.err.party-too-large' });
    const gone = deps({ submit: async () => { throw apiError(403); } });
    expect(await quickRsvp(gone)).toEqual({ kind: 'error', errorKey: 'reg.err.not-allowed' });
  });

  it('a closed registration is an error', async () => {
    const d = deps({ fetchRegistration: async () => ({ ...plain, closedReason: 'deadline_passed' }) });
    expect(await quickRsvp(d)).toEqual({ kind: 'error', errorKey: 'reg.err.closed' });
  });
});

describe('createSingleFlight', () => {
  it('drops a second tap while the first is running', async () => {
    const run = createSingleFlight();
    let release: () => void = () => undefined;
    const task = jest.fn(() => new Promise<string>((r) => { release = () => r('ok'); }));
    const first = run(task);
    expect(await run(task)).toBeUndefined();
    release();
    expect(await first).toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
    release = () => undefined;
    await run(async () => 'again');
  });
});
