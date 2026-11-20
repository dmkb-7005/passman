import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { AppDB } from './schema';
import { SCHEMA_VERSION } from './version';

/** Per-device settings (docs/DATA-MODEL.md §5). Not synced. */
export interface Settings {
  lockIdleMinutes: number;
  lockBackgroundSeconds: number;
  backupReminderDays: number | null;
  generator: {
    length: number;
    lower: boolean;
    upper: boolean;
    digits: boolean;
    symbols: boolean;
    avoidLookAlikes: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  lockIdleMinutes: 5,
  lockBackgroundSeconds: 60,
  backupReminderDays: 30,
  generator: { length: 20, lower: true, upper: true, digits: true, symbols: true, avoidLookAlikes: true },
};

/** Fills in a stored settings object with defaults for keys it doesn't have yet. */
export function withDefaults(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    generator: { ...DEFAULT_SETTINGS.generator, ...(s.generator ?? {}) },
  };
}

/**
 * Runs on every start: writes schemaVersion, creates the device id once and fills in settings that don't exist
 * yet. Never overwrites a stored value.
 */
export async function ensureDefaults(database: AppDB): Promise<void> {
  await database.transaction('rw', database.meta, async () => {
    await database.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
    if (!(await database.meta.get('deviceId'))) await database.meta.put({ key: 'deviceId', value: crypto.randomUUID() });
    const current = await database.meta.get('settings');
    await database.meta.put({ key: 'settings', value: withDefaults(current?.value) });
  });
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Live settings; undefined while loading. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => withDefaults((await db.meta.get('settings'))?.value), []);
}

/** Live value of one meta key; undefined while loading, null when absent. */
export function useMeta<T>(key: string): T | null | undefined {
  return useLiveQuery(async () => ((await db.meta.get(key))?.value as T | undefined) ?? null, [key]);
}

/** Changes some settings on this device, keeping the others. */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const current = withDefaults((await db.meta.get('settings'))?.value);
    await db.meta.put({ key: 'settings', value: { ...current, ...patch, generator: { ...current.generator, ...(patch.generator ?? {}) } } });
  });
}
