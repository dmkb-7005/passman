import { fromBase64Url, toBase64Url } from './bytes';
import { deriveKeyDirect, type Argon2Params } from './kdf';
import { formatRecoveryKey, generateRecoveryKey, InvalidRecoveryKeyError, parseRecoveryKey } from './recoveryKey';
import {
  changePassword,
  createVault,
  decryptSecret,
  decryptWithSession,
  encryptSecret,
  openWithPassword,
  openWithRecoveryKey,
  parseVaultFile,
  replaceRecoveryKey,
  resetPasswordWithRecoveryKey,
  sealPayload,
  VaultFormatError,
  WrongSecretError,
  type VaultFile,
} from './vaultFile';
import type { Payload } from '../domain/logins';

// Cheapest accepted parameters keep the tests fast; DEFAULT_ARGON2 is timed separately below.
const FAST: Argon2Params = { memoryKiB: 8192, iterations: 1, parallelism: 1 };
const derive = deriveKeyDirect;
const PW = 'correct horse battery staple';

const payload: Payload = {
  schemaVersion: 1,
  logins: [
    { id: 'a', name: 'Amazon', url: 'amazon.de', username: 'me@example.com', password: 'pässwörd 🔑', createdAt: '2026-11-20T10:00:00.000Z', updatedAt: '2026-11-20T10:00:00.000Z' },
    { id: 'b', deleted: true, updatedAt: '2026-11-20T11:00:00.000Z' },
  ],
};

/** Stored files go through JSON (IndexedDB, Dropbox, backups). */
const roundTrip = (file: VaultFile): unknown => JSON.parse(JSON.stringify(file));

function flipChar(b64: string): string {
  const bytes = fromBase64Url(b64);
  bytes[bytes.length - 1]! ^= 1;
  return toBase64Url(bytes);
}

describe('base64url', () => {
  it('round-trips all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });
  it('rejects other characters', () => {
    expect(() => fromBase64Url('ab+/')).toThrow();
  });
});

describe('Argon2id', () => {
  it('matches the reference test vector (argon2id v19, m=65536, t=2, p=1)', async () => {
    const key = await deriveKeyDirect('password', new TextEncoder().encode('somesalt'), { memoryKiB: 65536, iterations: 2, parallelism: 1 });
    expect(Buffer.from(key).toString('hex')).toBe('09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7');
  });
});

describe('recovery key', () => {
  it('formats as 8 groups of 4 Crockford characters and parses back', () => {
    const bytes = generateRecoveryKey();
    const text = formatRecoveryKey(bytes);
    expect(text).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(parseRecoveryKey(text)).toEqual(bytes);
  });
  it('accepts lower case, spaces, missing dashes and look-alike letters', () => {
    const bytes = Uint8Array.from({ length: 20 }, (_, i) => i * 13);
    const text = formatRecoveryKey(bytes);
    const typed = text.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(parseRecoveryKey(typed)).toEqual(bytes);
  });
  it('rejects wrong length and invalid characters', () => {
    expect(() => parseRecoveryKey('ABCD-EFGH')).toThrow(InvalidRecoveryKeyError);
    expect(() => parseRecoveryKey('U'.repeat(32))).toThrow(InvalidRecoveryKeyError);
  });
});

describe('vault file', () => {
  it('creates an empty vault that opens with the password and with the recovery key', async () => {
    const created = await createVault(PW, derive, { argon2: FAST });
    expect(created.payload.logins).toEqual([]);
    const file = roundTrip(created.session.file);
    expect((await openWithPassword(file, PW, derive)).payload.logins).toEqual([]);
    expect((await openWithRecoveryKey(file, created.recoveryKey, derive)).session.vaultId).toBe(created.session.vaultId);
  });

  it('seals and reopens a payload; every seal uses a new IV', async () => {
    const { session } = await createVault(PW, derive, { argon2: FAST });
    const a = await sealPayload(session, payload);
    const b = await sealPayload(session, payload);
    expect(a.payload.iv).not.toBe(b.payload.iv);
    expect((await openWithPassword(roundTrip(a), PW, derive)).payload).toEqual(payload);
    // the stored file contains no readable login data
    expect(JSON.stringify(a)).not.toMatch(/Amazon|example\.com/);
  });

  it('rejects a wrong password and a recovery key of another vault', async () => {
    const one = await createVault(PW, derive, { argon2: FAST });
    const two = await createVault(PW, derive, { argon2: FAST });
    await expect(openWithPassword(roundTrip(one.session.file), 'wrong password!', derive)).rejects.toThrow(WrongSecretError);
    await expect(openWithRecoveryKey(roundTrip(one.session.file), two.recoveryKey, derive)).rejects.toMatchObject({ secret: 'recovery-key' });
    await expect(openWithRecoveryKey(roundTrip(one.session.file), 'nonsense', derive)).rejects.toThrow(InvalidRecoveryKeyError);
  });

  it('treats the password as NFC: composed and decomposed accents give the same key', async () => {
    const { session } = await createVault('Café crème brûlée', derive, { argon2: FAST });
    await expect(openWithPassword(roundTrip(session.file), 'Café crème brûlée', derive)).resolves.toBeDefined();
  });

  it('detects tampering with the payload, the vault id or the keyset', async () => {
    const { session } = await createVault(PW, derive, { argon2: FAST });
    const file = await sealPayload(session, payload);
    await expect(openWithPassword({ ...file, payload: { ...file.payload, ciphertext: flipChar(file.payload.ciphertext) } }, PW, derive)).rejects.toMatchObject({ problem: 'damaged' });
    await expect(openWithPassword({ ...file, vaultId: crypto.randomUUID() }, PW, derive)).rejects.toThrow();
    const keyset = { ...file.keyset, password: { ...file.keyset.password, wrappedKey: flipChar(file.keyset.password.wrappedKey) } };
    await expect(openWithPassword({ ...file, keyset }, PW, derive)).rejects.toThrow(WrongSecretError);
  });

  it('gives clear errors for other files, newer versions and broken headers', () => {
    expect(() => parseVaultFile({ hello: 1 })).toThrow(expect.objectContaining({ problem: 'not-a-vault' }));
    expect(() => parseVaultFile(null)).toThrow(VaultFormatError);
    expect(() => parseVaultFile({ format: 'passman-vault', version: 2 })).toThrow(expect.objectContaining({ problem: 'newer-version' }));
    expect(() => parseVaultFile({ format: 'passman-vault', version: 1 })).toThrow(expect.objectContaining({ problem: 'damaged' }));
  });

  it('refuses absurd Argon2 parameters in a file', async () => {
    const { session } = await createVault(PW, derive, { argon2: FAST });
    const kdf = { ...session.file.keyset.password.kdf, memoryKiB: 64 * 1024 * 1024 };
    const bad = { ...session.file, keyset: { ...session.file.keyset, password: { ...session.file.keyset.password, kdf } } };
    expect(() => parseVaultFile(bad)).toThrow(expect.objectContaining({ problem: 'damaged' }));
  });

  it('changes the master password: old fails, new and recovery key work, data unchanged', async () => {
    const created = await createVault(PW, derive, { argon2: FAST });
    const file = await sealPayload(created.session, payload);
    const changed = await changePassword(file, PW, 'a brand new passphrase', derive, { argon2: FAST });
    expect(changed.keyset.id).not.toBe(file.keyset.id);
    await expect(changePassword(file, 'wrong password!', 'x'.repeat(12), derive, { argon2: FAST })).rejects.toThrow(WrongSecretError);
    await expect(openWithPassword(roundTrip(changed), PW, derive)).rejects.toThrow(WrongSecretError);
    expect((await openWithPassword(roundTrip(changed), 'a brand new passphrase', derive)).payload).toEqual(payload);
    expect((await openWithRecoveryKey(roundTrip(changed), created.recoveryKey, derive)).payload).toEqual(payload);
    // the open session's key still decrypts the re-keyed file (the DEK never changes)
    expect((await decryptWithSession(created.session, roundTrip(changed))).payload).toEqual(payload);
  });

  it('resets a forgotten password with the recovery key', async () => {
    const created = await createVault(PW, derive, { argon2: FAST });
    const reset = await resetPasswordWithRecoveryKey(created.session.file, created.recoveryKey.toLowerCase(), 'remembered this time', derive, { argon2: FAST });
    await expect(openWithPassword(roundTrip(reset), 'remembered this time', derive)).resolves.toBeDefined();
    await expect(openWithRecoveryKey(roundTrip(reset), created.recoveryKey, derive)).resolves.toBeDefined();
  });

  it('replaces the recovery key: the old one stops working', async () => {
    const created = await createVault(PW, derive, { argon2: FAST });
    const { file, recoveryKey } = await replaceRecoveryKey(created.session.file, PW, derive);
    expect(recoveryKey).not.toBe(created.recoveryKey);
    await expect(openWithRecoveryKey(roundTrip(file), created.recoveryKey, derive)).rejects.toThrow(WrongSecretError);
    await expect(openWithRecoveryKey(roundTrip(file), recoveryKey, derive)).resolves.toBeDefined();
    await expect(openWithPassword(roundTrip(file), PW, derive)).resolves.toBeDefined();
  });

  it('does not decrypt a copy of a different vault with the session', async () => {
    const one = await createVault(PW, derive, { argon2: FAST });
    const two = await createVault(PW, derive, { argon2: FAST });
    await expect(decryptWithSession(one.session, roundTrip(two.session.file))).rejects.toThrow(VaultFormatError);
  });

  it('encrypts small secrets bound to their purpose', async () => {
    const { session } = await createVault(PW, derive, { argon2: FAST });
    const secret = await encryptSecret(session, 'dropbox-refresh-token', 'token-value');
    expect(await decryptSecret(session, 'dropbox-refresh-token', secret)).toBe('token-value');
    await expect(decryptSecret(session, 'other-purpose', secret)).rejects.toThrow();
  });

  it('derives with the production parameters (timing printed for reference)', async () => {
    const start = performance.now();
    const created = await createVault(PW, derive);
    await openWithPassword(roundTrip(created.session.file), PW, derive);
    const ms = Math.round((performance.now() - start) / 2);
    console.log(`Argon2id 64 MiB / 3 passes: ~${ms} ms per derivation on this machine`);
    expect(created.session.file.keyset.password.kdf).toMatchObject({ memoryKiB: 65536, iterations: 3, parallelism: 1 });
  }, 30_000);
});
