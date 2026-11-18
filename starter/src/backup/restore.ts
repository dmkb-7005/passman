import { DATA_TABLES, type AppDB } from '../db/schema';
import { SCHEMA_VERSION } from '../db/version';
import type { Backup } from './schema';

/**
 * Replaces every data table with the backup's content in ONE transaction: it either fully succeeds
 * or leaves the database untouched. `lastBackupAt` is device state and is kept.
 * The caller validates with `parseBackup` and downloads a recovery copy first.
 */
export async function restoreBackup(database: AppDB, backup: Backup): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const t of DATA_TABLES) await database.table(t).clear();
    for (const t of DATA_TABLES) await database.table(t).bulkAdd(backup[t]);
    await database.meta.bulkPut([
      { key: 'schemaVersion', value: SCHEMA_VERSION },
      ...Object.entries(backup.settings).map(([key, value]) => ({ key, value })),
    ]);
  });
}
