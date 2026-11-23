import { pickHero } from './heroPick';
import type { Today } from './today';

const today = (openBallots: number, board?: Today['board']): Today =>
  ({ generatedAt: '', openRsvps: [], cancelled: [], unreadAnnouncements: 0, dueReturns: [], openBallots, board: board ?? null, setup: null }) as unknown as Today;
const event = { id: 'e1' } as never;

describe('pickHero priority', () => {
  it('an open vote beats everything', () => {
    expect(pickHero(today(2, { openApplications: 3 }), event, false, false)).toEqual({ kind: 'vote', count: 2 });
  });
  it('then the next event', () => {
    expect(pickHero(today(0, { openApplications: 3 }), event, true, true).kind).toBe('event');
  });
  it('then loading, then error', () => {
    expect(pickHero(today(0, { openApplications: 3 }), null, true, true).kind).toBe('loading');
    expect(pickHero(today(0, { openApplications: 3 }), null, false, true).kind).toBe('error');
  });
  it('then open applications for the board', () => {
    expect(pickHero(today(0, { openApplications: 3 }), null, false, false)).toEqual({ kind: 'board', count: 3 });
  });
  it('else the calm empty state', () => {
    expect(pickHero(today(0, { openApplications: 0 }), null, false, false).kind).toBe('empty');
    expect(pickHero(null, null, false, false).kind).toBe('empty');
  });
});
