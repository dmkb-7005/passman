/** Byte helpers shared by the crypto modules. */

export type Bytes = Uint8Array<ArrayBuffer>;

export function randomBytes(length: number): Bytes {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/** Copies into a fresh ArrayBuffer-backed array (what WebCrypto's types expect). */
export function toBytes(data: Uint8Array): Bytes {
  const out = new Uint8Array(data.length);
  out.set(data);
  return out;
}

export function utf8(text: string): Bytes {
  return toBytes(new TextEncoder().encode(text));
}

export function fromUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Throws on characters outside the base64url alphabet. */
export function fromBase64Url(text: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('Invalid base64url');
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Best effort: overwrite key material we no longer need (JS can't guarantee no copies exist). */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}
