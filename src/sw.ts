/*
 * PassMan service worker with an approved-build gate (docs/ARCHITECTURE.md §5.1).
 *
 * - Precaches this build into its own cache, then activates straight away.
 * - Always serves the APPROVED build. A newer build stays pending until the app sends `approve`.
 * - Never touches IndexedDB and never handles requests to other origins (Dropbox).
 *
 * Built by vite-plugin-pwa (strategies: 'injectManifest'); `self.__WB_MANIFEST` is replaced by the precache list.
 */
import {
  approve,
  buildIdFor,
  cacheNameFor,
  cachesToDelete,
  resolveServing,
  stateAfterInstall,
  statusOf,
  type GateState,
  type PrecacheEntry,
} from './sw/gate';
import type { SwReply, SwRequest } from './sw/messages';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

const MANIFEST: PrecacheEntry[] = [
  ...new Map(
    self.__WB_MANIFEST.map((e) => (typeof e === 'string' ? { url: e, revision: null } : e)).map((e) => [e.url, e] as const),
  ).values(),
];
const CURRENT = buildIdFor(MANIFEST);
const STATE_CACHE = 'passman-sw-state';

const inScope = (path: string) => new URL(path, self.registration.scope).href;
const STATE_URL = inScope('__sw-state.json');
const INDEX_URL = inScope('index.html');
const VERSION_URL = inScope('version.json');

// ---------- gate state (kept in Cache Storage, since the worker may be restarted at any time) ----------
let memo: GateState | null = null;

async function readState(): Promise<GateState> {
  if (memo) return memo;
  const hit = await (await caches.open(STATE_CACHE)).match(STATE_URL);
  const parsed = hit ? ((await hit.json().catch(() => null)) as GateState | null) : null;
  memo = parsed && (typeof parsed.approved === 'string' || parsed.approved === null) ? parsed : { approved: null };
  return memo;
}

async function writeState(state: GateState): Promise<void> {
  memo = state;
  const cache = await caches.open(STATE_CACHE);
  await cache.put(STATE_URL, new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } }));
}

async function servingBuild(): Promise<string> {
  const state = await readState();
  const names = new Set(await caches.keys());
  const resolved = resolveServing(state, CURRENT, (b) => names.has(cacheNameFor(b)));
  if (resolved.state !== state) await writeState(resolved.state);
  return resolved.build;
}

async function deleteOldCaches(): Promise<void> {
  const doomed = cachesToDelete(await caches.keys(), await readState(), CURRENT);
  await Promise.all(doomed.map((name) => caches.delete(name)));
}

async function notifyClients(): Promise<void> {
  for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'gate-changed' });
}

// ---------- lifecycle ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheNameFor(CURRENT));
      await Promise.all(
        MANIFEST.map(async (entry) => {
          const url = inScope(entry.url);
          if (await cache.match(url)) return;
          // bypass the HTTP cache so a new build never mixes with stale files
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!response.ok) throw new Error(`Precaching ${entry.url} failed: HTTP ${response.status}`);
          await cache.put(url, response);
        }),
      );
      await writeState(stateAfterInstall(await readState(), CURRENT));
      // Activating is safe: the gate keeps serving the approved build.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await deleteOldCaches();
      await notifyClients();
    })(),
  );
});

// ---------- serving ----------
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith(serve(request));
});

async function serve(request: Request): Promise<Response> {
  try {
    const cache = await caches.open(cacheNameFor(await servingBuild()));
    const url = new URL(request.url);
    url.search = '';
    url.hash = '';
    const hit = await cache.match(request.mode === 'navigate' ? INDEX_URL : url.href);
    if (hit) return hit;
  } catch {
    // fall through to the network
  }
  return fetch(request);
}

// ---------- messages from the app ----------
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port) return;
  const reply = (message: SwReply) => port.postMessage(message);
  event.waitUntil(
    handle(event.data as SwRequest).then(reply, (err: unknown) => reply({ type: 'error', message: err instanceof Error ? err.message : String(err) })),
  );
});

async function handle(request: SwRequest): Promise<SwReply> {
  switch (request.type) {
    case 'status': {
      await servingBuild();
      return { type: 'status', ...statusOf(await readState(), CURRENT) };
    }
    case 'pending-info': {
      const { pending } = statusOf(await readState(), CURRENT);
      if (pending === null) return { type: 'pending-info', build: null, info: null };
      const hit = await (await caches.open(cacheNameFor(pending))).match(VERSION_URL);
      return { type: 'pending-info', build: pending, info: hit ? await hit.json().catch(() => null) : null };
    }
    case 'approve': {
      const result = approve(await readState(), CURRENT, request.build);
      if (result.ok) {
        await writeState(result.state);
        await deleteOldCaches();
      }
      return { type: 'approved', ok: result.ok };
    }
    default:
      return { type: 'error', message: 'Unknown request' };
  }
}
