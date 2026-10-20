import { useSyncExternalStore } from 'react';

import { isPushTargetStale, routeForTarget, type PushRoute, type PushTarget } from './pushLogic';

/**
 * In-memory hand-over of a tapped push from the notification listener to the router
 * (`PushDeepLinkRouter`) and on to the destination screen. Deliberately never persisted: it
 * holds ids only and must not outlive the process. `routed` flips once the app navigated to the
 * target's screen; only then may the screen consume it (a guest still sits on Login before that).
 */
interface Entry {
  target: PushTarget;
  receivedAt: number;
  routed: boolean;
}

let entry: Entry | null = null;
let navigationReady = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribePushTarget(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setIncomingPushTarget(target: PushTarget, now = Date.now()): void {
  entry = { target, receivedAt: now, routed: false };
  emit();
}

export function markPushTargetRouted(): void {
  if (entry && !entry.routed) {
    entry = { ...entry, routed: true };
    emit();
  }
}

export function clearPushTarget(): void {
  if (entry) {
    entry = null;
    emit();
  }
}

export function setNavigationReady(ready: boolean): void {
  if (navigationReady !== ready) {
    navigationReady = ready;
    emit();
  }
}

export function getNavigationReady(): boolean {
  return navigationReady;
}

/** The pending, not yet routed target (undefined entry or stale ones are dropped). */
export function getIncomingPushTarget(now = Date.now()): PushTarget | null {
  if (!entry || entry.routed) return null;
  if (isPushTargetStale(entry.receivedAt, now)) {
    entry = null;
    return null;
  }
  return entry.target;
}

/** The routed target if it belongs to `route` -- what a destination screen consumes. */
export function getRoutedPushTarget(route: PushRoute): PushTarget | null {
  return entry && entry.routed && routeForTarget(entry.target) === route ? entry.target : null;
}

export function useRoutedPushTarget(route: PushRoute): PushTarget | null {
  return useSyncExternalStore(subscribePushTarget, () => getRoutedPushTarget(route));
}

export function useIncomingPushTarget(): PushTarget | null {
  return useSyncExternalStore(subscribePushTarget, () => getIncomingPushTarget());
}

export function useNavigationReady(): boolean {
  return useSyncExternalStore(subscribePushTarget, getNavigationReady);
}
