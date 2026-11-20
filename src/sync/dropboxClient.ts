/*
 * The few Dropbox API calls PassMan needs (docs/sync-spike-results.md). Plain fetch, no SDK.
 * The app has "App folder" access, so paths are relative to Apps/PassMan/.
 */

export const VAULT_PATH = '/passman.vault';
const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

export interface RemoteMeta {
  rev: string;
  contentHash: string;
  serverModified: string;
}

export type UploadMode = { kind: 'add' } | { kind: 'update'; rev: string };
export type UploadResult = { ok: true; meta: RemoteMeta } | { ok: false; conflict: true };

/** What the sync engine needs from Dropbox; the tests use an in-memory fake. */
export interface DropboxApi {
  getMetadata(path: string): Promise<RemoteMeta | null>;
  download(path: string): Promise<{ meta: RemoteMeta; bytes: Uint8Array }>;
  upload(path: string, bytes: Uint8Array, mode: UploadMode): Promise<UploadResult>;
}

/** Dropbox answered something unexpected; `auth` means the sign-in is no longer valid. */
export class DropboxError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'network' | 'server' | 'not-found' = 'server') {
    super(message);
    this.name = 'DropboxError';
  }
}

/** Gives the current access token; `refresh` forces a new one (after a 401). */
export interface TokenSource {
  accessToken(refresh?: boolean): Promise<string>;
}

interface RawMeta {
  rev: string;
  content_hash: string;
  server_modified: string;
}
const toMeta = (m: RawMeta): RemoteMeta => ({ rev: m.rev, contentHash: m.content_hash, serverModified: m.server_modified });

/** Dropbox-API-Arg must be ASCII: escape everything else as \uXXXX. */
export function apiArg(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function createDropboxClient(tokens: TokenSource, fetchImpl: typeof fetch = (...args) => fetch(...args)): DropboxApi & {
  account(): Promise<{ accountId: string; email: string }>;
} {
  async function send(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await tokens.accessToken(attempt > 0);
      let response: Response;
      try {
        response = await fetchImpl(url, { ...init, cache: 'no-store', headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
      } catch {
        throw new DropboxError('PassMan can’t reach Dropbox', 'network');
      }
      if (response.status === 401 && attempt === 0) continue;
      if (response.status === 401) throw new DropboxError('Dropbox rejected the sign-in', 'auth');
      return response;
    }
    throw new DropboxError('Dropbox rejected the sign-in', 'auth');
  }

  async function rpc<T>(endpoint: string, args?: unknown): Promise<{ status: number; body: T }> {
    const init: RequestInit = { method: 'POST' };
    if (args !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(args);
    }
    const response = await send(`${API}/${endpoint}`, init);
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // plain-text error
    }
    return { status: response.status, body: body as T };
  }

  return {
    async getMetadata(path) {
      const r = await rpc<RawMeta & { error_summary?: string }>('files/get_metadata', { path });
      if (r.status === 200) return toMeta(r.body);
      if (r.status === 409 && String(r.body.error_summary).startsWith('path/not_found')) return null;
      throw new DropboxError(`Dropbox: ${r.body.error_summary ?? r.status}`);
    },
    async download(path) {
      const response = await send(`${CONTENT}/files/download`, { method: 'POST', headers: { 'Dropbox-API-Arg': apiArg({ path }) } });
      if (response.status === 409) throw new DropboxError('The vault file is missing in Dropbox', 'not-found');
      if (!response.ok) throw new DropboxError(`Dropbox download failed (${response.status})`);
      const header = response.headers.get('Dropbox-API-Result');
      if (!header) throw new DropboxError('Dropbox sent no file details');
      return { meta: toMeta(JSON.parse(header) as RawMeta), bytes: new Uint8Array(await response.arrayBuffer()) };
    },
    async upload(path, bytes, mode) {
      const arg = { path, mode: mode.kind === 'add' ? 'add' : { '.tag': 'update', update: mode.rev }, autorename: false, mute: true, strict_conflict: true };
      const body = new Uint8Array(bytes);
      const response = await send(`${CONTENT}/files/upload`, {
        method: 'POST',
        headers: { 'Dropbox-API-Arg': apiArg(arg), 'Content-Type': 'application/octet-stream' },
        body,
      });
      const text = await response.text();
      if (response.status === 409) return { ok: false, conflict: true };
      if (!response.ok) throw new DropboxError(`Dropbox upload failed (${response.status}): ${text.slice(0, 120)}`);
      return { ok: true, meta: toMeta(JSON.parse(text) as RawMeta) };
    },
    async account() {
      const r = await rpc<{ account_id: string; email: string }>('users/get_current_account');
      if (r.status !== 200) throw new DropboxError('Dropbox account details unavailable');
      return { accountId: r.body.account_id, email: r.body.email };
    },
  };
}
