import { isLogin, nextTimestamp, type Entry, type Login } from './logins';

/*
 * Restore (SCOPE §5.7): the vault's logins become exactly the backup's, as one ordinary change. Every login that
 * differs gets a fresh `updatedAt` and every login not in the backup a fresh tombstone, so the result wins the
 * merge on every other device and syncs without prompts.
 */

export interface RestorePlan {
  /** live logins in the backup */
  backupCount: number;
  /** live logins in the vault now */
  currentCount: number;
  /** in the vault now, not in the backup: deleted */
  removed: number;
  /** in the backup, not live in the vault (deleted since, or never there): added */
  added: number;
  /** in both, different content: back to the backup's version */
  reverted: number;
  /** nothing would change */
  same: boolean;
  /** latest change among the backup's logins (ISO), null when empty */
  backupLastChange: string | null;
  currentLastChange: string | null;
}

const sameContent = (a: Login, b: Login) => a.name === b.name && a.url === b.url && a.username === b.username && a.password === b.password;

function lastChange(logins: Login[]): string | null {
  return logins.reduce<string | null>((max, l) => (max === null || l.updatedAt > max ? l.updatedAt : max), null);
}

export function planRestore(current: readonly Entry[], backup: readonly Entry[]): RestorePlan {
  const now = current.filter(isLogin);
  const wanted = backup.filter(isLogin);
  const nowById = new Map(now.map((l) => [l.id, l]));
  const wantedIds = new Set(wanted.map((l) => l.id));
  let added = 0;
  let reverted = 0;
  for (const b of wanted) {
    const c = nowById.get(b.id);
    if (!c) added++;
    else if (!sameContent(b, c)) reverted++;
  }
  const removed = now.filter((l) => !wantedIds.has(l.id)).length;
  return {
    backupCount: wanted.length,
    currentCount: now.length,
    removed,
    added,
    reverted,
    same: removed === 0 && added === 0 && reverted === 0,
    backupLastChange: lastChange(wanted),
    currentLastChange: lastChange(now),
  };
}

/** The vault's new entries: the backup's logins, tombstones for everything else. */
export function applyRestore(current: readonly Entry[], backup: readonly Entry[], now: Date): Entry[] {
  const byId = new Map(current.map((e) => [e.id, e]));
  const wanted = backup.filter(isLogin);
  const wantedIds = new Set(wanted.map((l) => l.id));
  const result: Entry[] = [];
  for (const entry of current) {
    if (wantedIds.has(entry.id)) continue;
    // not in the backup: logins become tombstones, existing tombstones stay
    result.push(isLogin(entry) ? { id: entry.id, deleted: true, updatedAt: nextTimestamp(now, entry.updatedAt) } : entry);
  }
  for (const b of wanted) {
    const c = byId.get(b.id);
    if (c && isLogin(c) && sameContent(b, c)) {
      result.push(c); // unchanged: keep as it is
      continue;
    }
    const previous = c && c.updatedAt > b.updatedAt ? c.updatedAt : b.updatedAt;
    result.push({ ...b, updatedAt: nextTimestamp(now, previous) });
  }
  return result;
}
