/*
 * Auto-lock decision (SCOPE §5.2). Computed from timestamps, because timers are throttled while the app is in
 * the background.
 */

export interface LockState {
  now: number;
  /** last pointer, key or scroll event */
  lastActivity: number;
  /** when the app went to the background; null while visible */
  hiddenSince: number | null;
  idleMinutes: number;
  backgroundSeconds: number;
}

export type LockReason = 'idle' | 'background';

export function lockReason(s: LockState): LockReason | null {
  if (s.hiddenSince !== null && s.now - s.hiddenSince >= s.backgroundSeconds * 1000) return 'background';
  if (s.now - s.lastActivity >= s.idleMinutes * 60_000) return 'idle';
  return null;
}

/** Milliseconds until the idle lock would fire (for scheduling the next check while visible). */
export function msUntilIdleLock(s: Pick<LockState, 'now' | 'lastActivity' | 'idleMinutes'>): number {
  return Math.max(0, s.lastActivity + s.idleMinutes * 60_000 - s.now);
}
