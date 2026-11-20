import { toBytes } from '../crypto/bytes';

const BLOCK = 4 * 1024 * 1024;

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', toBytes(bytes)));
}

/** Dropbox `content_hash`: SHA-256 over the concatenated SHA-256 of each 4 MiB block (checked in the spike). */
export async function dropboxContentHash(bytes: Uint8Array): Promise<string> {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += BLOCK) parts.push(await sha256(bytes.subarray(i, i + BLOCK)));
  const joined = new Uint8Array(parts.length * 32);
  parts.forEach((p, i) => joined.set(p, i * 32));
  return [...(await sha256(joined))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
