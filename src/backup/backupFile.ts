import { parseVaultFile, VaultFormatError, type VaultFile, type VaultProblem } from '../crypto/vaultFile';

/*
 * Backup files (SCOPE §5.7, ARCHITECTURE §4.7): the encrypted vault file as JSON. `.json.txt` so Android can
 * share and open it; the content is never readable without the master password or recovery key.
 */

const MAX_BYTES = 20 * 1024 * 1024;

const two = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

export function backupFileName(date: Date, kind: 'backup' | 'before-restore' = 'backup'): string {
  return `passman-${kind}-${day(date)}.json.txt`;
}

export function encodeBackup(file: VaultFile): string {
  return `${JSON.stringify(file, null, 1)}\n`;
}

export type ReadBackup = { ok: true; file: VaultFile } | { ok: false; problem: VaultProblem | 'too-large' };

export function readBackup(text: string, size = text.length): ReadBackup {
  if (size > MAX_BYTES) return { ok: false, problem: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, problem: 'not-a-vault' };
  }
  try {
    return { ok: true, file: parseVaultFile(raw) };
  } catch (err) {
    return { ok: false, problem: err instanceof VaultFormatError ? err.problem : 'damaged' };
  }
}

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Android: the share sheet (Drive, Files, …). Elsewhere, or if sharing files isn't supported: a download.
 * `cancelled` when the user closed the share sheet.
 */
export async function saveFile(name: string, text: string, preferShare = true): Promise<SaveOutcome> {
  const blob = new Blob([text], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (preferShare && coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // share failed for another reason: fall back to a download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
