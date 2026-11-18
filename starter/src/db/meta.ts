import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { AppDB } from './schema';
import { SCHEMA_VERSION } from './version';

/** Settings that travel inside a backup. Add the app's own settings here. */
export const DEFAULT_SETTINGS = {
  /** days after which the backup reminder shows */
  backupReminderDays: 14,
} as const;

export type Settings = { backupReminderDays: number; lastBackupAt: string | null };

/** Writes schemaVersion and fills in settings that do not exist yet. Never overwrites a setting. */
export async function ensureDefaults(database: AppDB): Promise<void> {
  await database.transaction('rw', database.meta, async () => {
    await database.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(await database.meta.get(key))) await database.meta.put({ key, value });
    }
  });
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Live settings; undefined while loading. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const rows = await db.meta.toArray();
    const get = (k: string) => rows.find((r) => r.key === k)?.value;
    return {
      backupReminderDays: (get('backupReminderDays') as number | undefined) ?? DEFAULT_SETTINGS.backupReminderDays,
      lastBackupAt: (get('lastBackupAt') as string | undefined) ?? null,
    };
  }, []);
}
