import { DEFAULT_SETTINGS } from '../db/meta';
import { DATA_TABLES, type AppDB } from '../db/schema';
import { SCHEMA_VERSION } from '../db/version';
import { APP_ID } from './app';
import { backupSchema, type Backup } from './schema';

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, undefined, { numeric: true });

/** Reads every data table in one read-only transaction; rows sorted for stable, diff-friendly files. */
export async function buildBackup(database: AppDB, now: Date = new Date()): Promise<Backup> {
  return database.transaction('r', database.tables, async () => {
    const tables = Object.fromEntries(
      await Promise.all(DATA_TABLES.map(async (t) => [t, (await database.table(t).toArray()).sort(byId)] as const)),
    );
    const reminder = await database.meta.get('backupReminderDays');
    return backupSchema.parse({
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      settings: { backupReminderDays: reminder?.value ?? DEFAULT_SETTINGS.backupReminderDays },
      ...tables,
    });
  });
}

/** `<app>-backup-2026-11-18.json` (local date) */
export function backupFileName(now: Date = new Date(), kind: 'backup' | 'backup-recovery' = 'backup'): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${APP_ID}-${kind}-${d}.json`;
}
