import type { GateStatus } from './gate';

/** Messages from the app to the service worker (sent over a MessageChannel). */
export type SwRequest =
  | { type: 'status' }
  | { type: 'pending-info' }
  | { type: 'approve'; build: string };

/** Replies from the service worker. `info` is the pending build's version.json, unvalidated. */
export type SwReply =
  | ({ type: 'status' } & GateStatus)
  | { type: 'pending-info'; build: string | null; info: unknown }
  | { type: 'approved'; ok: boolean }
  | { type: 'error'; message: string };
