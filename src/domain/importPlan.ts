import type { ImportRow } from './chromeCsv';
import { createLogin, isLogin, siteKey, updateLogin, usernameKey, type Entry, type Login } from './logins';

/*
 * Duplicates review for the Chrome import (SCOPE §5.5).
 * A duplicate is the same site (URL host, or the name without a URL) with the same username. Each imported row is
 * compared with the vault first, then with earlier rows of the same file. Rows without a match are added.
 */

export type DuplicateTarget = { kind: 'vault'; login: Login } | { kind: 'file'; row: ImportRow };

export interface DuplicateItem {
  row: ImportRow;
  target: DuplicateTarget;
  /** same password too: starts on "Keep existing" */
  identical: boolean;
}

export interface ImportPlan {
  fresh: ImportRow[];
  duplicates: DuplicateItem[];
}

export type Decision = 'keep-existing' | 'use-imported' | 'keep-both';

const keyOf = (x: { name: string; url: string; username: string }) => `${siteKey(x)}\u0000${usernameKey(x)}`;

export function planImport(existing: readonly Entry[], rows: readonly ImportRow[]): ImportPlan {
  const vault = new Map<string, Login>();
  for (const login of existing.filter(isLogin).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))) {
    const key = keyOf(login);
    if (!vault.has(key)) vault.set(key, login);
  }
  const firstInFile = new Map<string, ImportRow>();
  const fresh: ImportRow[] = [];
  const duplicates: DuplicateItem[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    const login = vault.get(key);
    const earlier = firstInFile.get(key);
    if (login) duplicates.push({ row, target: { kind: 'vault', login }, identical: login.password === row.password });
    else if (earlier) duplicates.push({ row, target: { kind: 'file', row: earlier }, identical: earlier.password === row.password });
    else {
      firstInFile.set(key, row);
      fresh.push(row);
    }
  }
  return { fresh, duplicates };
}

/** Pre-selected choice in the review; null means the user has to decide. */
export function defaultDecision(item: DuplicateItem): Decision | null {
  return item.identical ? 'keep-existing' : null;
}

export interface ImportResult {
  entries: Entry[];
  added: number;
  replaced: number;
  skipped: number;
}

const fields = (row: ImportRow) => ({ name: row.name, url: row.url, username: row.username, password: row.password });

/**
 * Applies the plan. `decisions` is keyed by the duplicate's row number; every duplicate needs one.
 * "Use imported" overwrites the existing login (or the earlier row of the file) with the imported values.
 */
export function applyImport(
  existing: readonly Entry[],
  plan: ImportPlan,
  decisions: ReadonlyMap<number, Decision>,
  now: Date,
  newId: () => string = () => crypto.randomUUID(),
): ImportResult {
  const missing = plan.duplicates.filter((d) => !decisions.has(d.row.row));
  if (missing.length) throw new Error(`No decision for ${missing.length} duplicate(s)`);

  const entries = new Map(existing.map((e) => [e.id, e] as const));
  const fromFile = new Map<number, Login>();
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  for (const row of plan.fresh) {
    const login = createLogin(fields(row), now, newId());
    fromFile.set(row.row, login);
    entries.set(login.id, login);
    added++;
  }
  for (const item of plan.duplicates) {
    const decision = decisions.get(item.row.row)!;
    if (decision === 'keep-existing') {
      skipped++;
    } else if (decision === 'keep-both') {
      const login = createLogin(fields(item.row), now, newId());
      entries.set(login.id, login);
      added++;
    } else {
      const target = item.target.kind === 'vault' ? item.target.login : fromFile.get(item.target.row.row);
      const current = target ? entries.get(target.id) : undefined;
      if (!current || !isLogin(current)) {
        skipped++;
        continue;
      }
      entries.set(current.id, updateLogin(current, fields(item.row), now));
      replaced++;
    }
  }
  return { entries: [...entries.values()], added, replaced, skipped };
}
