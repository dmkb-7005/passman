import { z } from 'zod';
import { db } from '../db/db';

/*
 * Dropbox connection of this device, in `meta.sync` (docs/DATA-MODEL.md §4). The refresh token is encrypted with
 * the vault key, so it is unreadable while the vault is locked. Not synced.
 */

const SealedSchema = z.object({ iv: z.string(), ciphertext: z.string() });

export const SyncMetaSchema = z.object({
  accountId: z.string(),
  email: z.string(),
  refreshToken: SealedSchema,
  /** Dropbox rev this device last synced with */
  lastSyncedRev: z.string().nullable(),
  /** fileVersion() of the local vault at that moment: anything else means local changes to upload */
  syncedVersion: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
});
export type SyncMeta = z.infer<typeof SyncMetaSchema>;

export const REFRESH_TOKEN_PURPOSE = 'dropbox-refresh-token';

export function parseSyncMeta(value: unknown): SyncMeta | null {
  const parsed = SyncMetaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function readSyncMeta(): Promise<SyncMeta | null> {
  return parseSyncMeta((await db.meta.get('sync'))?.value);
}

export async function writeSyncMeta(meta: SyncMeta): Promise<void> {
  await db.meta.put({ key: 'sync', value: meta });
}

export async function updateSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const current = parseSyncMeta((await db.meta.get('sync'))?.value);
    if (current) await db.meta.put({ key: 'sync', value: { ...current, ...patch } });
  });
}

export async function deleteSyncMeta(): Promise<void> {
  await db.meta.delete('sync');
}
