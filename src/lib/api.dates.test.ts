// Mirrors the client Better Auth builds: better-fetch with a default JSON parser that revives ISO-Z strings into Date
// (better-auth/dist/client/parser.mjs, parseDates=true). A per-call `jsonParser` overrides it, exactly as in the real client.
jest.mock('@/auth/auth-client', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { betterFetch } = require('@better-fetch/fetch');
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/;
  const dateParser = (text: string) => JSON.parse(text, (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v));
  return {
    backendUrl: 'http://backend.test',
    authClient: { $fetch: (url: string, opts: object) => betterFetch(url, { jsonParser: dateParser, ...opts }) },
  };
});

import { apiFetch } from './api';
import { parseToday } from './today';

const body = {
  generatedAt: '2026-10-29T08:00:00.000Z',
  openRsvps: [{ eventId: 'e1', title: 'Training', startsAt: '2026-10-30T17:00:00.000Z' }],
  cancelled: [{ eventId: 'e2', title: 'Spiel', startsAt: '2026-10-31T17:00:00Z' }],
  dueReturns: [{ loanId: 'l1', itemName: 'Ball', dueAt: '2026-10-31T00:00:00Z' }],
  unreadAnnouncements: 0,
};

describe('apiFetch date handling', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('keeps ISO timestamps as strings so parseToday keeps its items', async () => {
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const res = await apiFetch<{ data: typeof body }>('/clubs/c1/today');
    expect(typeof res.data.openRsvps[0]!.startsAt).toBe('string');
    expect(typeof res.data.generatedAt).toBe('string');
    const t = parseToday(res);
    expect(t.openRsvps).toHaveLength(1);
    expect(t.cancelled).toHaveLength(1);
    expect(t.dueReturns).toHaveLength(1);
  });
});
