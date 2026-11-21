export type KalenderCommandKind = 'new' | 'manage' | 'feeds' | 'time' | 'myHours' | 'teamHours';
export interface PendingCommand {
  kind: KalenderCommandKind;
  n: number;
}

/** A new header command; the counter makes two taps of the same action two different commands. */
export function queueCommand(prev: PendingCommand | null, kind: KalenderCommandKind): PendingCommand {
  return { kind, n: (prev?.n ?? 0) + 1 };
}
