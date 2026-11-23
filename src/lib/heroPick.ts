import type { CalendarEvent } from '@/hooks/useEvents';
import type { Today } from './today';

export type Hero =
  | { kind: 'vote'; count: number }
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'board'; count: number }
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'error' };

/**
 * Hero priority (decision D7): an open vote that needs my answer, then today's next event, then the next upcoming
 * event, then a calm empty state with the next action. `useNextEvent` already returns the earliest event from now on,
 * so "today" wins over "later" by order.
 */
export function pickHero(today: Today | null, event: CalendarEvent | null, eventLoading: boolean, eventError: boolean): Hero {
  if (today && today.openBallots > 0) return { kind: 'vote', count: today.openBallots };
  if (event) return { kind: 'event', event };
  if (eventLoading) return { kind: 'loading' };
  if (eventError) return { kind: 'error' };
  const apps = today?.board?.openApplications ?? 0;
  if (apps > 0) return { kind: 'board', count: apps };
  return { kind: 'empty' };
}
