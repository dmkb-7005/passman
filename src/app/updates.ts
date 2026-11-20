import type { SwReply, SwRequest } from '../sw/messages';
import { parseBuildInfo, type BuildInfo } from './buildInfo';

/*
 * App side of the approved-build gate (docs/ARCHITECTURE.md §5.1). The service worker decides what is served;
 * this module asks it about pending builds and passes on the user's approval.
 */

const BASE = import.meta.env.BASE_URL;
let registration: ServiceWorkerRegistration | null = null;

/** Production only: the dev server has no service worker. */
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE, updateViaCache: 'none' });
  } catch {
    registration = null;
  }
}

function ask(request: SwRequest, timeoutMs = 5000): Promise<SwReply | null> {
  const worker = navigator.serviceWorker?.controller;
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<SwReply>) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage(request, [channel.port2]);
  });
}

/** Waits until a newly found worker has installed and activated (or failed), up to `timeoutMs`. */
function settle(worker: ServiceWorker | null, timeoutMs: number): Promise<void> {
  if (!worker || worker.state === 'activated' || worker.state === 'redundant') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      worker?.removeEventListener('statechange', onChange);
      resolve();
    }
    function onChange() {
      if (worker?.state === 'activated' || worker?.state === 'redundant') done();
    }
    worker.addEventListener('statechange', onChange);
  });
}

export interface PendingUpdate {
  build: string;
  /** null when the pending build's version.json is missing or malformed */
  info: BuildInfo | null;
}

export type UpdateCheck = { kind: 'pending'; update: PendingUpdate } | { kind: 'none' } | { kind: 'unavailable' };

/**
 * Looks for a build waiting for approval. With `askServer`, first asks the browser to check the server for a
 * new service worker and waits (up to 30 s) for it to install.
 */
export async function checkForUpdate(askServer: boolean): Promise<UpdateCheck> {
  if (!navigator.serviceWorker?.controller) return { kind: 'unavailable' };
  if (askServer && registration) {
    try {
      await registration.update();
      await settle(registration.installing ?? registration.waiting, 30_000);
    } catch {
      // offline: fall back to what is installed already
    }
  }
  const reply = await ask({ type: 'pending-info' });
  if (!reply || reply.type !== 'pending-info') return { kind: 'unavailable' };
  if (reply.build === null) return { kind: 'none' };
  return { kind: 'pending', update: { build: reply.build, info: parseBuildInfo(reply.info) } };
}

/** The user confirmed: switch to the pending build and reload. Returns false if the worker refused. */
export async function applyUpdate(update: PendingUpdate): Promise<boolean> {
  const reply = await ask({ type: 'approve', build: update.build });
  if (!reply || reply.type !== 'approved' || !reply.ok) return false;
  try {
    sessionStorage.setItem(JUST_UPDATED_KEY, update.info?.version ?? '');
  } catch {
    // only used for the "Updated to" snackbar
  }
  location.reload();
  return true;
}

const JUST_UPDATED_KEY = 'passman-just-updated';

/** Version number if this start follows an approved update (read once). */
export function takeJustUpdated(): string | null {
  try {
    const value = sessionStorage.getItem(JUST_UPDATED_KEY);
    sessionStorage.removeItem(JUST_UPDATED_KEY);
    return value;
  } catch {
    return null;
  }
}

/** Called when the worker changed (new build installed or approved elsewhere). */
export function onGateChanged(listener: () => void): () => void {
  const sw = navigator.serviceWorker;
  if (!sw) return () => {};
  const onMessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'gate-changed') listener();
  };
  sw.addEventListener('controllerchange', listener);
  sw.addEventListener('message', onMessage);
  return () => {
    sw.removeEventListener('controllerchange', listener);
    sw.removeEventListener('message', onMessage);
  };
}
