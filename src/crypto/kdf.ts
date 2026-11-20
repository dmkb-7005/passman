import { argon2id } from 'hash-wasm';
import { toBytes, type Bytes } from './bytes';

/** Argon2id cost parameters, stored per keyset in the vault file (docs/DATA-MODEL.md §1). */
export interface Argon2Params {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/** Target 0.5–1 s on the phone (docs/ARCHITECTURE.md §2.1). */
export const DEFAULT_ARGON2: Argon2Params = { memoryKiB: 65536, iterations: 3, parallelism: 1 };

/** Accepted range when opening a file: rejects absurd values that would hang the app. */
export const ARGON2_LIMITS = {
  memoryKiB: { min: 8192, max: 1048576 },
  iterations: { min: 1, max: 20 },
  parallelism: { min: 1, max: 8 },
} as const;

/** Derives a 32-byte key from the master password. Injected so tests and the worker share the code. */
export type DeriveKey = (password: string, salt: Uint8Array, params: Argon2Params) => Promise<Bytes>;

/**
 * Argon2id on the current thread. The password is NFC-normalised so "é" typed on Android and on Windows
 * gives the same key.
 */
export const deriveKeyDirect: DeriveKey = async (password, salt, params) => {
  const out = await argon2id({
    password: password.normalize('NFC'),
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: 32,
    outputType: 'binary',
  });
  return toBytes(out);
};
