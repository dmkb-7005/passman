import { fromUtf8, utf8 } from '../crypto/bytes';
import { decryptWithSession, parseVaultFile, type Keyset, type VaultFile, type VaultSession } from '../crypto/vaultFile';
import type { Entry } from '../domain/logins';
import { mergeEntries } from '../domain/merge';
import { dropboxContentHash } from './contentHash';
import { DropboxError, VAULT_PATH, type DropboxApi, type RemoteMeta } from './dropboxClient';

/*
 * Sync loop (docs/ARCHITECTURE.md §4.3). Dropbox rejects an upload based on an outdated rev, so a device can
 * never overwrite changes it hasn't merged: on a conflict the loop downloads, merges and tries again.
 */

// ---------- merging a downloaded copy ----------

export interface Integrated {
  entries: Entry[];
  keyset: Keyset;
  /** this device's vault changed */
  localChanged: boolean;
  /** Dropbox's copy lacks something this device has: upload the result */
  uploadNeeded: boolean;
}

/** Keyset with the later change wins (a new password or recovery key made on another device). */
function newerKeyset(local: Keyset, remote: Keyset): Keyset {
  if (local.id === remote.id) return local;
  const l = Date.parse(local.updatedAt);
  const r = Date.parse(remote.updatedAt);
  if (l !== r) return r > l ? remote : local;
  return remote.id < local.id ? remote : local;
}

/** Merges another copy of the same vault into the open one (login by login, keyset by date). */
export async function integrateRemote(session: VaultSession, localEntries: readonly Entry[], remote: VaultFile): Promise<Integrated> {
  const { payload } = await decryptWithSession(session, remote);
  const merged = mergeEntries(localEntries, payload.logins);
  const keyset = newerKeyset(session.file.keyset, remote.keyset);
  return {
    entries: merged.merged,
    keyset,
    localChanged: merged.localChanged || keyset.id !== session.file.keyset.id,
    uploadNeeded: merged.remoteChanged || keyset.id !== remote.keyset.id,
  };
}

// ---------- the loop ----------

/** This device's side of a sync, provided by the vault (writes go through its queue). */
export interface LocalSide {
  vaultId: string;
  /** the encrypted file as stored now, and a value that changes with every local change */
  snapshot(): { file: VaultFile; version: string };
  /** merges the downloaded vault into the local one and stores it */
  integrate(remote: VaultFile): Promise<{ uploadNeeded: boolean }>;
}

export type SyncOutcome =
  | { kind: 'synced'; meta: RemoteMeta; version: string; uploaded: boolean; downloaded: boolean }
  /** Dropbox holds a different vault (another vault id): the user has to choose */
  | { kind: 'vault-replaced'; remote: VaultFile; meta: RemoteMeta };

export class SyncConflictError extends Error {
  constructor() {
    super('Dropbox kept changing while PassMan was syncing. It will try again.');
    this.name = 'SyncConflictError';
  }
}

/** Changes whenever the stored vault file changes (every save uses a fresh IV; key changes get a new keyset id). */
export function fileVersion(file: VaultFile): string {
  return `${file.keyset.id}:${file.payload.iv}`;
}

export function encodeVault(file: VaultFile): Uint8Array {
  return utf8(JSON.stringify(file));
}

/** Downloads the vault file and checks it against Dropbox's content hash. */
export async function downloadVault(api: DropboxApi): Promise<{ file: VaultFile; meta: RemoteMeta }> {
  const { meta, bytes } = await api.download(VAULT_PATH);
  if ((await dropboxContentHash(bytes)) !== meta.contentHash) throw new DropboxError('The download from Dropbox was incomplete');
  let raw: unknown;
  try {
    raw = JSON.parse(fromUtf8(bytes));
  } catch {
    raw = null;
  }
  return { file: parseVaultFile(raw), meta };
}

export interface SyncInput {
  api: DropboxApi;
  local: LocalSide;
  /** Dropbox rev this device last synced with (null: never) */
  lastSyncedRev: string | null;
  /** local changes since then */
  dirty: boolean;
  maxAttempts?: number;
}

export async function runSync({ api, local, lastSyncedRev, dirty, maxAttempts = 3 }: SyncInput): Promise<SyncOutcome> {
  let knownRev = lastSyncedRev;
  let localChanges = dirty;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const meta = await api.getMetadata(VAULT_PATH);

    // first device: no vault in Dropbox yet
    if (!meta) {
      const snap = local.snapshot();
      const result = await api.upload(VAULT_PATH, encodeVault(snap.file), { kind: 'add' });
      if (result.ok) return { kind: 'synced', meta: result.meta, version: snap.version, uploaded: true, downloaded: false };
      continue;
    }

    let base = meta.rev;
    let downloaded = false;
    if (meta.rev !== knownRev) {
      const remote = await downloadVault(api);
      if (remote.file.vaultId !== local.vaultId) return { kind: 'vault-replaced', remote: remote.file, meta: remote.meta };
      const { uploadNeeded } = await local.integrate(remote.file);
      downloaded = true;
      base = remote.meta.rev;
      knownRev = remote.meta.rev;
      if (!uploadNeeded && !localChanges) {
        return { kind: 'synced', meta: remote.meta, version: local.snapshot().version, uploaded: false, downloaded };
      }
      localChanges = uploadNeeded || localChanges;
    } else if (!localChanges) {
      return { kind: 'synced', meta, version: local.snapshot().version, uploaded: false, downloaded };
    }

    const snap = local.snapshot();
    const result = await api.upload(VAULT_PATH, encodeVault(snap.file), { kind: 'update', rev: base });
    if (result.ok) return { kind: 'synced', meta: result.meta, version: snap.version, uploaded: true, downloaded };
    // someone uploaded in between: merge their version on the next round
    knownRev = null;
  }
  throw new SyncConflictError();
}
