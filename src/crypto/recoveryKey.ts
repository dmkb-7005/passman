import { randomBytes, type Bytes } from './bytes';

/*
 * Recovery key: 160 random bits as 32 Crockford Base32 characters in 8 groups of 4 (docs/DATA-MODEL.md §6).
 * Crockford's alphabet has no I, L, O or U, so it is easy to copy by hand.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_KEY_BYTES = 20;
const CHARS = 32;

export class InvalidRecoveryKeyError extends Error {
  constructor() {
    super("That isn't a valid recovery key");
    this.name = 'InvalidRecoveryKeyError';
  }
}

export function generateRecoveryKey(): Bytes {
  return randomBytes(RECOVERY_KEY_BYTES);
}

/** `7K3M-Q9TD-…` (8 groups of 4). */
export function formatRecoveryKey(bytes: Uint8Array): string {
  if (bytes.length !== RECOVERY_KEY_BYTES) throw new Error('Recovery key must be 20 bytes');
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return out.match(/.{4}/g)!.join('-');
}

/**
 * Accepts what people type: any case, spaces and dashes, O for 0, I or L for 1.
 * Throws InvalidRecoveryKeyError if it can't be a recovery key.
 */
export function parseRecoveryKey(text: string): Bytes {
  const clean = text
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (clean.length !== CHARS) throw new InvalidRecoveryKeyError();
  const out = new Uint8Array(RECOVERY_KEY_BYTES);
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const ch of clean) {
    const digit = ALPHABET.indexOf(ch);
    if (digit < 0) throw new InvalidRecoveryKeyError();
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      out[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return out;
}
