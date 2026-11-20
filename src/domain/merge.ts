import type { Entry } from './logins';

/*
 * Merge of two versions of the vault, login by login (docs/DATA-MODEL.md §3).
 * The later `updatedAt` wins; tombstones take part like any other version. Equal timestamps with different
 * content are resolved the same way on every device.
 */

/** JSON with sorted keys, so equal entries always compare equal. */
export function canonical(entry: Entry): string {
  const sorted = Object.keys(entry)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (entry as unknown as Record<string, unknown>)[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

function newer(a: Entry, b: Entry): Entry {
  const ta = Date.parse(a.updatedAt);
  const tb = Date.parse(b.updatedAt);
  if (ta !== tb) return ta > tb ? a : b;
  return canonical(a) <= canonical(b) ? a : b;
}

export interface MergeResult {
  /** sorted by id */
  merged: Entry[];
  /** the merged result differs from what this device had */
  localChanged: boolean;
  /** the merged result differs from the other copy, so it needs uploading */
  remoteChanged: boolean;
}

function sameSet(a: readonly Entry[], b: readonly Entry[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(canonical));
  return b.every((e) => keys.has(canonical(e)));
}

export function mergeEntries(local: readonly Entry[], remote: readonly Entry[]): MergeResult {
  const byId = new Map<string, Entry>();
  for (const entry of [...local, ...remote]) {
    const existing = byId.get(entry.id);
    byId.set(entry.id, existing ? newer(existing, entry) : entry);
  }
  const merged = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { merged, localChanged: !sameSet(merged, local), remoteChanged: !sameSet(merged, remote) };
}
