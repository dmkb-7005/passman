import { z } from 'zod';

/*
 * Logins and tombstones (docs/DATA-MODEL.md §2). Pure: no React, no Dexie, no crypto.
 */

export const LIMITS = { name: 100, url: 2000, username: 200, password: 1000 } as const;

const isoTimestamp = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid timestamp');
const id = z.string().min(1).max(64);

export const LoginSchema = z.object({
  id,
  name: z.string().min(1).max(LIMITS.name),
  /** empty string when there is no URL */
  url: z.string().max(LIMITS.url),
  /** empty string when there is no username */
  username: z.string().max(LIMITS.username),
  password: z.string().min(1).max(LIMITS.password),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export const TombstoneSchema = z.object({
  id,
  deleted: z.literal(true),
  updatedAt: isoTimestamp,
});

export const EntrySchema = z.union([TombstoneSchema, LoginSchema]);

export const PAYLOAD_SCHEMA_VERSION = 1;

export const PayloadSchema = z
  .object({
    schemaVersion: z.literal(PAYLOAD_SCHEMA_VERSION),
    logins: z.array(EntrySchema),
  })
  .refine((p) => new Set(p.logins.map((e) => e.id)).size === p.logins.length, 'Duplicate login ids');

export type Login = z.infer<typeof LoginSchema>;
export type Tombstone = z.infer<typeof TombstoneSchema>;
export type Entry = Login | Tombstone;
export type Payload = z.infer<typeof PayloadSchema>;

export function emptyPayload(): Payload {
  return { schemaVersion: PAYLOAD_SCHEMA_VERSION, logins: [] };
}

export function isLogin(entry: Entry): entry is Login {
  return !('deleted' in entry);
}

export function liveLogins(entries: readonly Entry[]): Login[] {
  return entries.filter(isLogin);
}

// ---------- editing ----------

export interface LoginInput {
  name: string;
  url: string;
  username: string;
  password: string;
}

export type LoginField = keyof LoginInput;

export type ValidationResult = { ok: true; value: LoginInput } | { ok: false; errors: Partial<Record<LoginField, string>> };

/** Trims name, URL and username (never the password) and checks the limits. Messages are UI copy. */
export function validateLoginInput(input: LoginInput): ValidationResult {
  const value: LoginInput = {
    name: input.name.trim(),
    url: input.url.trim(),
    username: input.username.trim(),
    password: input.password,
  };
  const errors: Partial<Record<LoginField, string>> = {};
  if (!value.name) errors.name = 'Enter a name';
  else if (value.name.length > LIMITS.name) errors.name = `Use at most ${LIMITS.name} characters`;
  if (value.url.length > LIMITS.url) errors.url = `Use at most ${LIMITS.url} characters`;
  if (value.username.length > LIMITS.username) errors.username = `Use at most ${LIMITS.username} characters`;
  if (!value.password) errors.password = 'Enter a password';
  else if (value.password.length > LIMITS.password) errors.password = `Use at most ${LIMITS.password} characters`;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/**
 * A timestamp strictly later than `previous`, so a change always wins the merge against the version it replaced,
 * even if the device clock is behind.
 */
export function nextTimestamp(now: Date, previous?: string): string {
  const prev = previous ? Date.parse(previous) : Number.NaN;
  const t = Number.isNaN(prev) ? now.getTime() : Math.max(now.getTime(), prev + 1);
  return new Date(t).toISOString();
}

export function createLogin(input: LoginInput, now: Date, newId: string = crypto.randomUUID()): Login {
  const ts = now.toISOString();
  return { id: newId, ...input, createdAt: ts, updatedAt: ts };
}

export function updateLogin(login: Login, input: LoginInput, now: Date): Login {
  return { ...login, ...input, updatedAt: nextTimestamp(now, login.updatedAt) };
}

export function deleteLogin(login: Login, now: Date): Tombstone {
  return { id: login.id, deleted: true, updatedAt: nextTimestamp(now, login.updatedAt) };
}

/** Undo of a delete: the login comes back as a newer change than the tombstone. */
export function restoreLogin(login: Login, tombstone: Tombstone, now: Date): Login {
  return { ...login, updatedAt: nextTimestamp(now, tombstone.updatedAt) };
}

/** Replaces the entry with the same id, or appends it. */
export function upsertEntry(entries: readonly Entry[], entry: Entry): Entry[] {
  const index = entries.findIndex((e) => e.id === entry.id);
  if (index < 0) return [...entries, entry];
  const copy = entries.slice();
  copy[index] = entry;
  return copy;
}

// ---------- matching, search, sorting ----------

/** Lower case, accents removed, whitespace collapsed. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Host in lower case without `www.`; for Chrome's Android entries (`android://…@com.example.app/`) the package
 * name. Empty if there is no usable host.
 */
export function hostOf(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  const android = /^android:\/\/[^@/]*@([^/?#]+)/i.exec(trimmed);
  if (android?.[1]) return android[1].toLowerCase();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** What "the same site" means for duplicates (docs/DATA-MODEL.md §2). */
export function siteKey(login: Pick<LoginInput, 'name' | 'url'>): string {
  return hostOf(login.url) || fold(login.name);
}

export function usernameKey(login: Pick<LoginInput, 'username'>): string {
  return login.username.trim().toLowerCase();
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** By name, then username; ignores case and accents. */
export function sortLogins(logins: readonly Login[]): Login[] {
  return [...logins].sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.username, b.username) || a.id.localeCompare(b.id));
}

/** Every word of the query must appear in the name, URL or username (case and accents ignored). */
export function searchLogins(logins: readonly Login[], query: string): Login[] {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return [...logins];
  return logins.filter((l) => {
    const haystack = fold(`${l.name} ${l.url} ${l.username}`);
    return words.every((w) => haystack.includes(w));
  });
}

/** Link target for "Open": https:// added when no scheme; anything but http(s) is not opened. */
export function urlForOpening(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^[^:/]+:\d+(\/|$)/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}
