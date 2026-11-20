import { randomBytes, toBytes, utf8, type Bytes } from './bytes';

/** AES-256-GCM with a fresh random 96-bit IV for every encryption. */

export class DecryptError extends Error {
  constructor() {
    super('Decryption failed');
    this.name = 'DecryptError';
  }
}

export interface Sealed {
  iv: Bytes;
  ciphertext: Bytes;
}

export function importAesKey(raw: Uint8Array, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toBytes(raw), { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
}

export async function aesEncrypt(key: CryptoKey, plaintext: Uint8Array, aad: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8(aad) }, key, toBytes(plaintext));
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}

/** Throws DecryptError for a wrong key or any change to IV, ciphertext or associated data. */
export async function aesDecrypt(key: CryptoKey, sealed: Sealed, aad: string): Promise<Bytes> {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: utf8(aad) }, key, sealed.ciphertext);
    return new Uint8Array(plain);
  } catch {
    throw new DecryptError();
  }
}

/** Key from the (fully random) recovery key: HKDF-SHA256, no slow KDF needed. */
export async function deriveRecoveryKek(recoveryKey: Uint8Array, salt: Uint8Array, info: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', toBytes(recoveryKey), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: toBytes(salt), info: utf8(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
