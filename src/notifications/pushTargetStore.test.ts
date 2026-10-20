import { PUSH_TARGET_MAX_AGE_MS } from './pushLogic';
import {
  clearPushTarget,
  getIncomingPushTarget,
  getRoutedPushTarget,
  markPushTargetRouted,
  setIncomingPushTarget,
} from './pushTargetStore';

const event = { kind: 'event', eventId: 'e1', clubId: 'c1' } as const;

beforeEach(() => clearPushTarget());

describe('pushTargetStore', () => {
  it('holds a tap as incoming until it is routed, then hands it to its screen only', () => {
    setIncomingPushTarget(event, 1000);
    expect(getIncomingPushTarget(1000)).toEqual(event);
    expect(getRoutedPushTarget('Kalender')).toBeNull();

    markPushTargetRouted();
    expect(getIncomingPushTarget(1000)).toBeNull();
    expect(getRoutedPushTarget('Kalender')).toEqual(event);
    expect(getRoutedPushTarget('Mitteilungen')).toBeNull();
  });

  it('is consumed by clearing', () => {
    setIncomingPushTarget(event);
    markPushTargetRouted();
    clearPushTarget();
    expect(getRoutedPushTarget('Kalender')).toBeNull();
  });

  it('drops a stale tap that never got routed (e.g. abandoned login)', () => {
    setIncomingPushTarget(event, 1000);
    expect(getIncomingPushTarget(1000 + PUSH_TARGET_MAX_AGE_MS + 1)).toBeNull();
    expect(getIncomingPushTarget(1000)).toBeNull();
  });

  it('a newer tap replaces an older one', () => {
    setIncomingPushTarget(event);
    setIncomingPushTarget({ kind: 'inbox', clubId: null });
    expect(getIncomingPushTarget()).toEqual({ kind: 'inbox', clubId: null });
  });
});
