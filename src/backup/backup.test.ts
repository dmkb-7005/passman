import { deriveKeyDirect, type Argon2Params } from '../crypto/kdf';
import { createVault } from '../crypto/vaultFile';
import { backupFileName, encodeBackup, readBackup } from './backupFile';

const FAST: Argon2Params = { memoryKiB: 8192, iterations: 1, parallelism: 1 };

describe('backup file', () => {
  it('names files by local date', () => {
    expect(backupFileName(new Date(2026, 10, 21, 8, 0))).toBe('passman-backup-2026-11-21.json.txt');
    expect(backupFileName(new Date(2026, 0, 3), 'before-restore')).toBe('passman-before-restore-2026-01-03.json.txt');
  });

  it('round-trips the vault file', async () => {
    const { session } = await createVault('correct horse battery staple', deriveKeyDirect, { argon2: FAST });
    const read = readBackup(encodeBackup(session.file));
    expect(read).toEqual({ ok: true, file: session.file });
    expect(readBackup(`﻿${encodeBackup(session.file)}`).ok).toBe(true);
  });

  it('explains what is wrong with other files', async () => {
    expect(readBackup('name,url\n')).toEqual({ ok: false, problem: 'not-a-vault' });
    expect(readBackup('{"format":"something-else"}')).toEqual({ ok: false, problem: 'not-a-vault' });
    expect(readBackup('{"format":"passman-vault","version":99}')).toEqual({ ok: false, problem: 'newer-version' });
    expect(readBackup('{"format":"passman-vault","version":1}')).toMatchObject({ ok: false });
    expect(readBackup('{}', 30 * 1024 * 1024)).toEqual({ ok: false, problem: 'too-large' });
  });
});
