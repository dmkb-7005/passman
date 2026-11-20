import type { Bytes } from './bytes';
import { deriveKeyDirect, type DeriveKey } from './kdf';

/*
 * Browser-only wrapper: Argon2id in a Web Worker. Falls back to the main thread where workers are unavailable.
 * Not unit tested (no workers in Node); the logic it runs is deriveKeyDirect, which is.
 */

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (key: Bytes) => void; reject: (err: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  worker = new Worker(new URL('./kdf.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<{ id: number; key?: Uint8Array<ArrayBuffer>; error?: string }>) => {
    const pending = waiting.get(event.data.id);
    if (!pending) return;
    waiting.delete(event.data.id);
    if (event.data.key) pending.resolve(event.data.key);
    else pending.reject(new Error(event.data.error ?? 'Key derivation failed'));
  });
  worker.addEventListener('error', () => {
    for (const pending of waiting.values()) pending.reject(new Error('Key derivation worker failed'));
    waiting.clear();
    worker = null;
  });
  return worker;
}

export const deriveKeyInWorker: DeriveKey = (password, salt, params) => {
  const w = getWorker();
  if (!w) return deriveKeyDirect(password, salt, params);
  const id = nextId++;
  return new Promise<Bytes>((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    w.postMessage({ id, password, salt, params });
  });
};
