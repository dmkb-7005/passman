import { deriveKeyDirect, type Argon2Params } from '../crypto/kdf';
import { changePassword, createVault, decryptWithSession, sealPayload, type VaultFile, type VaultSession } from '../crypto/vaultFile';
import { createLogin, deleteLogin, liveLogins, upsertEntry, type Entry, type Login } from '../domain/logins';
import { dropboxContentHash } from './contentHash';
import { apiArg, createDropboxClient, VAULT_PATH, type DropboxApi, type RemoteMeta, type UploadMode } from './dropboxClient';
import { tokenSource } from './dropboxAuth';
import { downloadVault, encodeVault, integrateRemote, runSync, SyncConflictError, type LocalSide } from './syncEngine';

const FAST: Argon2Params = { memoryKiB: 8192, iterations: 1, parallelism: 1 };
const PW = 'correct horse battery staple';

// ---------- a Dropbox that behaves like the real one ----------

class FakeDropbox implements DropboxApi {
  bytes: Uint8Array | null = null;
  meta: RemoteMeta | null = null;
  uploads = 0;
  private revCounter = 0;
  /** runs right before an upload is applied (simulates another device uploading in between) */
  beforeUpload: (() => Promise<void>) | null = null;
  corruptDownload = false;

  async getMetadata(path: string) {
    expect(path).toBe(VAULT_PATH);
    return this.meta ? { ...this.meta } : null;
  }
  async download() {
    if (!this.bytes || !this.meta) throw new Error('not found');
    const bytes = new Uint8Array(this.bytes);
    if (this.corruptDownload) bytes[bytes.length - 2] = (bytes[bytes.length - 2] ?? 0) ^ 1;
    return { meta: { ...this.meta }, bytes };
  }
  async upload(_path: string, bytes: Uint8Array, mode: UploadMode) {
    const hook = this.beforeUpload;
    this.beforeUpload = null;
    if (hook) await hook();
    if (mode.kind === 'add' ? this.meta !== null : this.meta?.rev !== mode.rev) return { ok: false as const, conflict: true as const };
    return { ok: true as const, meta: await this.put(bytes) };
  }
  async put(bytes: Uint8Array): Promise<RemoteMeta> {
    this.uploads++;
    this.bytes = new Uint8Array(bytes);
    this.meta = { rev: `rev${++this.revCounter}`, contentHash: await dropboxContentHash(bytes), serverModified: new Date().toISOString() };
    return { ...this.meta };
  }
}

// ---------- a device: open vault + stored file + sync state ----------

class Device {
  version = 0;
  lastSyncedRev: string | null = null;
  syncedVersion = '0';
  constructor(
    public session: VaultSession,
    public entries: Entry[],
  ) {}

  static async create(logins: Login[] = []): Promise<Device> {
    const { session } = await createVault(PW, deriveKeyDirect, { argon2: FAST });
    const d = new Device(session, []);
    for (const l of logins) await d.edit(l);
    return d;
  }
  /** a second device that joined from Dropbox's copy */
  static async join(file: VaultFile, of: Device): Promise<Device> {
    const session = { ...of.session, file };
    const { payload } = await decryptWithSession(session, file);
    return new Device(session, payload.logins);
  }
  async edit(entry: Entry) {
    this.entries = upsertEntry(this.entries, entry);
    this.session = { ...this.session, file: await sealPayload(this.session, { schemaVersion: 1, logins: this.entries }) };
    this.version++;
  }
  get logins() {
    return liveLogins(this.entries).map((l) => l.name).sort();
  }
  side(): LocalSide {
    return {
      vaultId: this.session.vaultId,
      snapshot: () => ({ file: this.session.file, version: String(this.version) }),
      integrate: async (remote) => {
        const r = await integrateRemote(this.session, this.entries, remote);
        if (r.localChanged) {
          this.entries = r.entries;
          const sealed = await sealPayload(this.session, { schemaVersion: 1, logins: r.entries });
          this.session = { ...this.session, file: { ...sealed, keyset: r.keyset } };
          this.version++;
        }
        return { uploadNeeded: r.uploadNeeded };
      },
    };
  }
  async sync(api: DropboxApi) {
    const outcome = await runSync({ api, local: this.side(), lastSyncedRev: this.lastSyncedRev, dirty: String(this.version) !== this.syncedVersion });
    if (outcome.kind === 'synced') {
      this.lastSyncedRev = outcome.meta.rev;
      this.syncedVersion = outcome.version;
    }
    return outcome;
  }
}

let t = Date.parse('2026-11-20T10:00:00.000Z');
const tick = () => new Date((t += 1000));
const login = (name: string) => createLogin({ name, url: '', username: `${name.toLowerCase()}@example.com`, password: 'pw' }, tick());

describe('Dropbox content hash', () => {
  it('matches Dropbox’s documented example for an empty file and is block based', async () => {
    // SHA-256(SHA-256("")) over zero blocks = SHA-256 of nothing
    expect(await dropboxContentHash(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const a = await dropboxContentHash(new Uint8Array(5 * 1024 * 1024).fill(1));
    const b = await dropboxContentHash(new Uint8Array(5 * 1024 * 1024).fill(1).fill(2, 4 * 1024 * 1024));
    expect(a).not.toBe(b);
  });
});

describe('sync engine', () => {
  it('first device uploads its vault, then has nothing to do', async () => {
    const box = new FakeDropbox();
    const a = await Device.create([login('Amazon')]);
    expect(await a.sync(box)).toMatchObject({ kind: 'synced', uploaded: true, downloaded: false });
    expect(box.uploads).toBe(1);
    expect(await a.sync(box)).toMatchObject({ kind: 'synced', uploaded: false, downloaded: false });
    expect(box.uploads).toBe(1);
  });

  it('two devices exchange additions, edits and deletions', async () => {
    const box = new FakeDropbox();
    const amazon = login('Amazon');
    const a = await Device.create([amazon, login('Bank')]);
    await a.sync(box);
    const b = await Device.join((await downloadVault(box)).file, a);
    b.lastSyncedRev = box.meta!.rev;

    await a.edit(login('Chess'));
    await b.edit(login('Dentist'));
    await b.edit(deleteLogin(amazon, tick()));

    expect(await a.sync(box)).toMatchObject({ uploaded: true });
    expect(await b.sync(box)).toMatchObject({ downloaded: true, uploaded: true });
    expect(await a.sync(box)).toMatchObject({ downloaded: true, uploaded: false });
    expect(a.logins).toEqual(['Bank', 'Chess', 'Dentist']);
    expect(b.logins).toEqual(a.logins);
    expect(await b.sync(box)).toMatchObject({ uploaded: false, downloaded: false });
  });

  it('retries when another device uploads in between, and loses nothing', async () => {
    const box = new FakeDropbox();
    const a = await Device.create([login('Amazon')]);
    await a.sync(box);
    const b = await Device.join((await downloadVault(box)).file, a);
    b.lastSyncedRev = box.meta!.rev;

    await a.edit(login('From A'));
    await b.edit(login('From B'));
    box.beforeUpload = async () => {
      await b.sync(box);
    };
    expect(await a.sync(box)).toMatchObject({ kind: 'synced', uploaded: true, downloaded: true });
    await b.sync(box);
    expect(a.logins).toEqual(['Amazon', 'From A', 'From B']);
    expect(b.logins).toEqual(a.logins);
  });

  it('gives up after repeated conflicts', async () => {
    const box = new FakeDropbox();
    const a = await Device.create([login('Amazon')]);
    await a.sync(box);
    await a.edit(login('More'));
    const always: DropboxApi = { ...box, getMetadata: (p) => box.getMetadata(p), download: () => box.download(), upload: async () => ({ ok: false, conflict: true }) };
    await expect(runSync({ api: always, local: a.side(), lastSyncedRev: a.lastSyncedRev, dirty: true })).rejects.toBeInstanceOf(SyncConflictError);
  });

  it('reports a different vault instead of merging or overwriting it', async () => {
    const box = new FakeDropbox();
    const a = await Device.create([login('Amazon')]);
    await a.sync(box);
    const other = await Device.create([login('Test')]);
    const before = box.uploads;
    expect(await other.sync(box)).toMatchObject({ kind: 'vault-replaced' });
    expect(box.uploads).toBe(before);
  });

  it('adopts a newer master password from another device', async () => {
    const box = new FakeDropbox();
    const a = await Device.create([login('Amazon')]);
    await a.sync(box);
    const b = await Device.join((await downloadVault(box)).file, a);
    b.lastSyncedRev = box.meta!.rev;

    const changed = await changePassword(b.session.file, PW, 'a brand new master password', deriveKeyDirect, { argon2: FAST, now: new Date(Date.now() + 60_000) });
    b.session = { ...b.session, file: changed };
    b.version++;
    await b.sync(box);
    await a.edit(login('Bank'));
    await a.sync(box);
    expect(a.session.file.keyset.id).toBe(changed.keyset.id);
    expect((await downloadVault(box)).file.keyset.id).toBe(changed.keyset.id);
  });

  it('rejects an incomplete download', async () => {
    const box = new FakeDropbox();
    const a = await Device.create([login('Amazon')]);
    await a.sync(box);
    box.corruptDownload = true;
    await expect(downloadVault(box)).rejects.toThrow('incomplete');
  });

  it('stores exactly the vault file format', async () => {
    const a = await Device.create([login('Amazon')]);
    expect(JSON.parse(new TextDecoder().decode(encodeVault(a.session.file)))).toEqual(a.session.file);
  });
});

// ---------- HTTP layer ----------

describe('Dropbox client', () => {
  const tokens = { accessToken: async (refresh?: boolean) => (refresh ? 'new' : 'old') };

  it('escapes non-ASCII in Dropbox-API-Arg', () => {
    expect(apiArg({ path: '/ä' })).toBe('{"path":"/\\u00e4"}');
  });

  it('maps not_found to null and retries once with a fresh token after 401', async () => {
    const seen: string[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization!;
      seen.push(auth);
      if (auth === 'Bearer old') return new Response('', { status: 401 });
      return new Response(JSON.stringify({ error_summary: 'path/not_found/..' }), { status: 409 });
    }) as unknown as typeof fetch;
    const client = createDropboxClient(tokens, fake);
    expect(await client.getMetadata(VAULT_PATH)).toBeNull();
    expect(seen).toEqual(['Bearer old', 'Bearer new']);
  });

  it('turns a 409 upload into a conflict and sends update(rev)', async () => {
    let arg = '';
    const fake = (async (_url: string, init: RequestInit) => {
      arg = (init.headers as Record<string, string>)['Dropbox-API-Arg']!;
      return new Response('{"error_summary":"path/conflict/file/"}', { status: 409 });
    }) as unknown as typeof fetch;
    const result = await createDropboxClient(tokens, fake).upload(VAULT_PATH, new Uint8Array([1]), { kind: 'update', rev: 'r1' });
    expect(result).toEqual({ ok: false, conflict: true });
    expect(JSON.parse(arg).mode).toEqual({ '.tag': 'update', update: 'r1' });
  });

  it('reports network failures as such', async () => {
    const fake = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(createDropboxClient(tokens, fake).getMetadata(VAULT_PATH)).rejects.toMatchObject({ kind: 'network' });
  });

  it('refreshes the access token once for concurrent callers', async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response(JSON.stringify({ access_token: `t${calls}`, expires_in: 14400 }), { status: 200 });
    }) as unknown as typeof fetch;
    const source = tokenSource('key', 'refresh', undefined, fake);
    expect(await Promise.all([source.accessToken(), source.accessToken()])).toEqual(['t1', 't1']);
    expect(await source.accessToken()).toBe('t1');
    expect(calls).toBe(1);
  });
});
