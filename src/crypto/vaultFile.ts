import { z } from 'zod';
import { emptyPayload, PayloadSchema, type Payload } from '../domain/logins';
import { aesDecrypt, aesEncrypt, DecryptError, deriveRecoveryKek, importAesKey, type Sealed } from './aes';
import { fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8, wipe, type Bytes } from './bytes';
import { ARGON2_LIMITS, DEFAULT_ARGON2, type Argon2Params, type DeriveKey } from './kdf';
import { formatRecoveryKey, generateRecoveryKey, parseRecoveryKey } from './recoveryKey';

/*
 * The vault file (docs/DATA-MODEL.md §1, docs/ARCHITECTURE.md §2.1). The same file lives in IndexedDB, in Dropbox
 * and in backups.
 *
 * - A random vault key (DEK) encrypts the payload. It never changes for the life of the vault.
 * - The DEK is stored twice: wrapped with a key from the master password (Argon2id) and with a key from the
 *   recovery key (HKDF). Changing either only re-wraps the DEK.
 */

export const VAULT_FORMAT = 'passman-vault';
export const VAULT_VERSION = 1;
const RECOVERY_INFO = 'passman/recovery/v1';

// ---------- errors (messages are UI copy) ----------

export type VaultProblem = 'not-a-vault' | 'newer-version' | 'damaged';

export class VaultFormatError extends Error {
  constructor(readonly problem: VaultProblem) {
    super(
      problem === 'not-a-vault'
        ? "This isn't a PassMan vault file"
        : problem === 'newer-version'
          ? 'This vault was made by a newer PassMan. Update the app first.'
          : 'This vault file is damaged or was changed',
    );
    this.name = 'VaultFormatError';
  }
}

export class WrongSecretError extends Error {
  constructor(readonly secret: 'password' | 'recovery-key') {
    super(secret === 'password' ? 'Wrong master password' : "This recovery key doesn't open this vault");
    this.name = 'WrongSecretError';
  }
}

// ---------- file schema ----------

const b64 = z.string().max(100_000_000).regex(/^[A-Za-z0-9_-]*$/);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

const WrappedKey = z.object({ iv: b64, wrappedKey: b64 });

const KeysetSchema = z.object({
  id: z.string().min(1).max(64),
  updatedAt: z.string().max(40),
  password: WrappedKey.extend({
    kdf: z.object({
      alg: z.literal('argon2id'),
      memoryKiB: int(ARGON2_LIMITS.memoryKiB.min, ARGON2_LIMITS.memoryKiB.max),
      iterations: int(ARGON2_LIMITS.iterations.min, ARGON2_LIMITS.iterations.max),
      parallelism: int(ARGON2_LIMITS.parallelism.min, ARGON2_LIMITS.parallelism.max),
      salt: b64,
    }),
  }),
  recovery: WrappedKey.extend({
    kdf: z.object({ alg: z.literal('hkdf-sha256'), salt: b64, info: z.literal(RECOVERY_INFO) }),
  }),
});

export const VaultFileSchema = z.object({
  format: z.literal(VAULT_FORMAT),
  version: z.literal(VAULT_VERSION),
  vaultId: z.string().min(1).max(64),
  keyset: KeysetSchema,
  payload: z.object({ iv: b64, ciphertext: b64 }),
});

export type VaultFile = z.infer<typeof VaultFileSchema>;
export type Keyset = VaultFile['keyset'];

/** Checks the outer shape: clear messages for other files and newer versions, "damaged" for everything else. */
export function parseVaultFile(raw: unknown): VaultFile {
  const head = raw as { format?: unknown; version?: unknown } | null;
  if (!head || typeof head !== 'object' || head.format !== VAULT_FORMAT) throw new VaultFormatError('not-a-vault');
  if (typeof head.version === 'number' && head.version > VAULT_VERSION) throw new VaultFormatError('newer-version');
  const result = VaultFileSchema.safeParse(raw);
  if (!result.success) throw new VaultFormatError('damaged');
  return result.data;
}

// ---------- sessions ----------

/** An unlocked vault: the DEK (non-extractable) plus the header to write the next version with. */
export interface VaultSession {
  vaultId: string;
  dek: CryptoKey;
  file: VaultFile;
}

export interface OpenedVault {
  session: VaultSession;
  payload: Payload;
}

const payloadAad = (vaultId: string) => `${VAULT_FORMAT}|${VAULT_VERSION}|${vaultId}`;
const wrapAad = (vaultId: string, kind: 'password' | 'recovery') => `passman/dek/v1|${kind}|${vaultId}`;
const sealed = (w: { iv: string; wrappedKey?: string; ciphertext?: string }): Sealed => ({
  iv: fromBase64Url(w.iv),
  ciphertext: fromBase64Url(w.wrappedKey ?? w.ciphertext ?? ''),
});

async function passwordKek(password: string, kdf: Keyset['password']['kdf'], derive: DeriveKey): Promise<CryptoKey> {
  const raw = await derive(password, fromBase64Url(kdf.salt), { memoryKiB: kdf.memoryKiB, iterations: kdf.iterations, parallelism: kdf.parallelism });
  try {
    return await importAesKey(raw);
  } finally {
    wipe(raw);
  }
}

async function wrapWithPassword(dekRaw: Bytes, vaultId: string, password: string, params: Argon2Params, derive: DeriveKey): Promise<Keyset['password']> {
  const kdf = { alg: 'argon2id' as const, ...params, salt: toBase64Url(randomBytes(16)) };
  const kek = await passwordKek(password, kdf, derive);
  const w = await aesEncrypt(kek, dekRaw, wrapAad(vaultId, 'password'));
  return { kdf, iv: toBase64Url(w.iv), wrappedKey: toBase64Url(w.ciphertext) };
}

async function wrapWithRecoveryKey(dekRaw: Bytes, vaultId: string, recoveryKey: Bytes): Promise<Keyset['recovery']> {
  const kdf = { alg: 'hkdf-sha256' as const, salt: toBase64Url(randomBytes(16)), info: RECOVERY_INFO as typeof RECOVERY_INFO };
  const kek = await deriveRecoveryKek(recoveryKey, fromBase64Url(kdf.salt), kdf.info);
  const w = await aesEncrypt(kek, dekRaw, wrapAad(vaultId, 'recovery'));
  return { kdf, iv: toBase64Url(w.iv), wrappedKey: toBase64Url(w.ciphertext) };
}

type Unlock = { password: string } | { recoveryKey: string };

/** Unwraps the raw DEK with the master password or the recovery key. Caller wipes the result. */
async function unwrapDek(file: VaultFile, unlock: Unlock, derive: DeriveKey): Promise<Bytes> {
  if ('password' in unlock) {
    const kek = await passwordKek(unlock.password, file.keyset.password.kdf, derive);
    try {
      return await aesDecrypt(kek, sealed(file.keyset.password), wrapAad(file.vaultId, 'password'));
    } catch (err) {
      if (err instanceof DecryptError) throw new WrongSecretError('password');
      throw err;
    }
  }
  const recovery = parseRecoveryKey(unlock.recoveryKey);
  try {
    const kek = await deriveRecoveryKek(recovery, fromBase64Url(file.keyset.recovery.kdf.salt), file.keyset.recovery.kdf.info);
    return await aesDecrypt(kek, sealed(file.keyset.recovery), wrapAad(file.vaultId, 'recovery'));
  } catch (err) {
    if (err instanceof DecryptError) throw new WrongSecretError('recovery-key');
    throw err;
  } finally {
    wipe(recovery);
  }
}

async function encryptPayload(dek: CryptoKey, vaultId: string, payload: Payload): Promise<VaultFile['payload']> {
  const s = await aesEncrypt(dek, utf8(JSON.stringify(payload)), payloadAad(vaultId));
  return { iv: toBase64Url(s.iv), ciphertext: toBase64Url(s.ciphertext) };
}

async function decryptPayload(dek: CryptoKey, file: VaultFile): Promise<Payload> {
  let text: string;
  try {
    text = fromUtf8(await aesDecrypt(dek, sealed(file.payload), payloadAad(file.vaultId)));
  } catch {
    throw new VaultFormatError('damaged');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new VaultFormatError('damaged');
  }
  const result = PayloadSchema.safeParse(json);
  if (!result.success) throw new VaultFormatError('damaged');
  return result.data;
}

// ---------- public API ----------

export interface CreateOptions {
  argon2?: Argon2Params;
  now?: Date;
}

/** A new, empty vault. The recovery key is returned once, formatted for display, and never stored. */
export async function createVault(password: string, derive: DeriveKey, options: CreateOptions = {}): Promise<OpenedVault & { recoveryKey: string }> {
  const vaultId = crypto.randomUUID();
  const dekRaw = randomBytes(32);
  const recovery = generateRecoveryKey();
  try {
    const keyset: Keyset = {
      id: crypto.randomUUID(),
      updatedAt: (options.now ?? new Date()).toISOString(),
      password: await wrapWithPassword(dekRaw, vaultId, password, options.argon2 ?? DEFAULT_ARGON2, derive),
      recovery: await wrapWithRecoveryKey(dekRaw, vaultId, recovery),
    };
    const dek = await importAesKey(dekRaw);
    const payload = emptyPayload();
    const file: VaultFile = { format: VAULT_FORMAT, version: VAULT_VERSION, vaultId, keyset, payload: await encryptPayload(dek, vaultId, payload) };
    return { session: { vaultId, dek, file }, payload, recoveryKey: formatRecoveryKey(recovery) };
  } finally {
    wipe(dekRaw);
    wipe(recovery);
  }
}

async function open(raw: unknown, unlock: Unlock, derive: DeriveKey): Promise<OpenedVault> {
  const file = parseVaultFile(raw);
  const dekRaw = await unwrapDek(file, unlock, derive);
  try {
    const dek = await importAesKey(dekRaw);
    return { session: { vaultId: file.vaultId, dek, file }, payload: await decryptPayload(dek, file) };
  } finally {
    wipe(dekRaw);
  }
}

export function openWithPassword(raw: unknown, password: string, derive: DeriveKey): Promise<OpenedVault> {
  return open(raw, { password }, derive);
}

/** Throws InvalidRecoveryKeyError for a malformed key, WrongSecretError for a key of another vault. */
export function openWithRecoveryKey(raw: unknown, recoveryKey: string, derive: DeriveKey): Promise<OpenedVault> {
  return open(raw, { recoveryKey }, derive);
}

/** Decrypts another copy of the same vault (e.g. the Dropbox version) with the open session's key. */
export async function decryptWithSession(session: VaultSession, raw: unknown): Promise<{ file: VaultFile; payload: Payload }> {
  const file = parseVaultFile(raw);
  if (file.vaultId !== session.vaultId) throw new VaultFormatError('not-a-vault');
  return { file, payload: await decryptPayload(session.dek, file) };
}

/** Encrypts a new payload under the session's header. Every call uses a fresh IV. */
export async function sealPayload(session: VaultSession, payload: Payload): Promise<VaultFile> {
  return { ...session.file, payload: await encryptPayload(session.dek, session.vaultId, payload) };
}

/** A file with the same payload but another keyset (e.g. adopting a newer keyset from another device). */
export function withKeyset(file: VaultFile, keyset: Keyset): VaultFile {
  return { ...file, keyset };
}

function newKeysetMeta(now: Date): Pick<Keyset, 'id' | 'updatedAt'> {
  return { id: crypto.randomUUID(), updatedAt: now.toISOString() };
}

/** Change the master password (needs the current one). The recovery key keeps working. */
export async function changePassword(file: VaultFile, current: string, next: string, derive: DeriveKey, options: CreateOptions = {}): Promise<VaultFile> {
  const dekRaw = await unwrapDek(file, { password: current }, derive);
  try {
    const password = await wrapWithPassword(dekRaw, file.vaultId, next, options.argon2 ?? DEFAULT_ARGON2, derive);
    return withKeyset(file, { ...file.keyset, ...newKeysetMeta(options.now ?? new Date()), password });
  } finally {
    wipe(dekRaw);
  }
}

/** Forgotten password: open with the recovery key and set a new master password. The recovery key stays valid. */
export async function resetPasswordWithRecoveryKey(file: VaultFile, recoveryKey: string, next: string, derive: DeriveKey, options: CreateOptions = {}): Promise<VaultFile> {
  const dekRaw = await unwrapDek(file, { recoveryKey }, derive);
  try {
    const password = await wrapWithPassword(dekRaw, file.vaultId, next, options.argon2 ?? DEFAULT_ARGON2, derive);
    return withKeyset(file, { ...file.keyset, ...newKeysetMeta(options.now ?? new Date()), password });
  } finally {
    wipe(dekRaw);
  }
}

/** New recovery key (needs the master password); the old one stops working. Returned once for display. */
export async function replaceRecoveryKey(file: VaultFile, password: string, derive: DeriveKey, options: Pick<CreateOptions, 'now'> = {}): Promise<{ file: VaultFile; recoveryKey: string }> {
  const dekRaw = await unwrapDek(file, { password }, derive);
  const recovery = generateRecoveryKey();
  try {
    const wrapped = await wrapWithRecoveryKey(dekRaw, file.vaultId, recovery);
    return {
      file: withKeyset(file, { ...file.keyset, ...newKeysetMeta(options.now ?? new Date()), recovery: wrapped }),
      recoveryKey: formatRecoveryKey(recovery),
    };
  } finally {
    wipe(dekRaw);
    wipe(recovery);
  }
}

/** Small secrets stored next to the vault (the Dropbox refresh token), encrypted with the DEK. */
export async function encryptSecret(session: VaultSession, purpose: string, text: string): Promise<{ iv: string; ciphertext: string }> {
  const s = await aesEncrypt(session.dek, utf8(text), `passman/secret/v1|${purpose}|${session.vaultId}`);
  return { iv: toBase64Url(s.iv), ciphertext: toBase64Url(s.ciphertext) };
}

export async function decryptSecret(session: VaultSession, purpose: string, value: { iv: string; ciphertext: string }): Promise<string> {
  return fromUtf8(await aesDecrypt(session.dek, sealed(value), `passman/secret/v1|${purpose}|${session.vaultId}`));
}
