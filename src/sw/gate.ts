/*
 * Approved-build gate (docs/ARCHITECTURE.md §5.1). Pure logic shared by the service worker and the tests.
 *
 * Every build precaches into its own cache. The worker serves the APPROVED build, whichever worker version is
 * running; a newer build stays pending until the user confirms it in the app.
 */

export interface PrecacheEntry {
  url: string;
  revision: string | null;
}

export interface GateState {
  /** build id whose files are served; null before the first install finished */
  approved: string | null;
}

export interface GateStatus {
  current: string;
  approved: string | null;
  /** the installed build waiting for confirmation, if any */
  pending: string | null;
}

const PREFIX = 'passman-build-';

/** Stable id for a build: a hash of its precache list (file names + revisions). */
export function buildIdFor(manifest: readonly PrecacheEntry[]): string {
  const text = manifest
    .map((e) => `${e.url}#${e.revision ?? ''}`)
    .sort()
    .join('\n');
  // cyrb53: fast 53-bit string hash, plenty to tell builds apart (not a security property)
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function cacheNameFor(build: string): string {
  return PREFIX + build;
}

export function buildFromCacheName(name: string): string | null {
  return name.startsWith(PREFIX) ? name.slice(PREFIX.length) : null;
}

/** After the current build finished precaching: the very first build is approved automatically. */
export function stateAfterInstall(state: GateState, current: string): GateState {
  return state.approved === null ? { approved: current } : state;
}

/**
 * Which build to serve. If the approved build's cache has disappeared (storage cleared by the browser),
 * nothing else can be served, so the current build becomes the approved one.
 */
export function resolveServing(state: GateState, current: string, cacheExists: (build: string) => boolean): { build: string; state: GateState } {
  if (state.approved !== null && cacheExists(state.approved)) return { build: state.approved, state };
  return { build: current, state: { approved: current } };
}

export function statusOf(state: GateState, current: string): GateStatus {
  const approved = state.approved;
  return { current, approved, pending: approved !== null && approved !== current ? current : null };
}

/** The user confirmed an update. Only the build this worker installed can be approved. */
export function approve(state: GateState, current: string, requested: string): { ok: boolean; state: GateState } {
  if (requested !== current) return { ok: false, state };
  return { ok: true, state: { approved: current } };
}

/** Build caches that may be deleted: everything except the approved and the current build. */
export function cachesToDelete(cacheNames: readonly string[], state: GateState, current: string): string[] {
  const keep = new Set([current, state.approved].filter((b): b is string => b !== null));
  return cacheNames.filter((name) => {
    const build = buildFromCacheName(name);
    return build !== null && !keep.has(build);
  });
}
