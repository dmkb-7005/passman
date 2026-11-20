import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSnackbar } from '../components/Snackbar';
import { db } from '../db/db';
import { VaultFormatError, WrongSecretError, type VaultFile } from '../crypto/vaultFile';
import type { SyncState } from '../features/logins/SyncChip';
import { useVault } from '../vault/VaultProvider';
import { DROPBOX_APP_KEY, revoke, tokenSource, type Tokens } from './dropboxAuth';
import { createDropboxClient, DropboxError, VAULT_PATH, type RemoteMeta, type TokenSource } from './dropboxClient';
import { beginSignIn, completeSignIn, type SignInResult } from './signIn';
import { encodeVault, fileVersion, runSync, SyncConflictError, type LocalSide } from './syncEngine';
import { deleteSyncMeta, parseSyncMeta, readSyncMeta, REFRESH_TOKEN_PURPOSE, updateSyncMeta, writeSyncMeta, type SyncMeta } from './syncMeta';
import { VaultChoiceSheet } from './VaultChoiceSheet';

/*
 * When and how this device syncs (docs/ARCHITECTURE.md §4.3). Syncs only while the vault is unlocked (merging and
 * the refresh token need the vault key): after unlocking, shortly after every change, when the app comes back to
 * the foreground or online, every few minutes, and on "Sync now".
 */

export type SyncProblemKind = 'auth' | 'network' | 'other';
export interface SyncProblem {
  kind: SyncProblemKind;
  /** one plain sentence, e.g. "Dropbox rejected the sign-in." */
  message: string;
}

/** Signed in at Dropbox, waiting for the unlocked vault to store the connection. */
export interface PendingConnection {
  tokens: Tokens;
  email: string;
  /** join: the Dropbox copy this device's vault was just made from */
  base?: { rev: string; version: string };
}

export interface VaultChoice {
  remote: VaultFile;
  meta: RemoteMeta;
}

interface SyncApi {
  chip: SyncState;
  /** null: not connected */
  connection: { email: string; lastSyncedAt: string | null } | null;
  running: boolean;
  /** local changes not in Dropbox yet */
  dirty: boolean;
  problem: SyncProblem | null;
  syncNow: () => void;
  /** leaves the app for Dropbox's sign-in (from Settings) */
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** the result of a sign-in started from Welcome ("Use my vault from Dropbox") */
  joinResult: SignInResult | null;
  /** null when the redirect has been handled (or there was none) */
  redirectHandled: boolean;
  beginJoin: (options?: { anotherAccount?: boolean }) => Promise<void>;
  clearJoinResult: () => void;
  connectWhenUnlocked: (pending: PendingConnection) => void;
}

const SyncContext = createContext<SyncApi | null>(null);

export function useSync(): SyncApi {
  const api = useContext(SyncContext);
  if (!api) throw new Error('useSync outside SyncProvider');
  return api;
}

const PERIODIC_MS = 5 * 60_000;
const AFTER_CHANGE_MS = 1500;
const RETRY_DELAYS_MS = [2000, 6000];

class LockedError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function problemFor(err: unknown): SyncProblem {
  if (err instanceof DropboxError) {
    if (err.kind === 'auth') return { kind: 'auth', message: 'Dropbox rejected the sign-in.' };
    if (err.kind === 'network') return { kind: 'network', message: 'PassMan couldn’t reach Dropbox after 3 tries.' };
    return { kind: 'other', message: 'Dropbox sent an answer PassMan didn’t expect.' };
  }
  if (err instanceof SyncConflictError) return { kind: 'other', message: 'Dropbox kept changing while PassMan was syncing.' };
  if (err instanceof VaultFormatError && err.problem === 'newer-version') {
    return { kind: 'other', message: 'The vault in Dropbox was saved by a newer version of PassMan. Update PassMan on this device.' };
  }
  if (err instanceof VaultFormatError || err instanceof WrongSecretError) return { kind: 'other', message: 'The vault in Dropbox changed in a way PassMan can’t merge.' };
  return { kind: 'other', message: 'Something went wrong while syncing.' };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const vault = useVault();
  const snackbar = useSnackbar();
  const meta = useLiveQuery(async () => parseSyncMeta((await db.meta.get('sync'))?.value), []);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<SyncProblem | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [choice, setChoice] = useState<VaultChoice | null>(null);
  const [joinResult, setJoinResult] = useState<SignInResult | null>(null);
  const [redirectHandled, setRedirectHandled] = useState(false);

  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  // stable callbacks: the snackbar object changes whenever a message shows
  const snackbarRef = useRef(snackbar);
  snackbarRef.current = snackbar;
  const unlocked = vault.status === 'unlocked';
  const busy = useRef(false);
  const again = useRef(false);
  const choiceOpen = useRef(false);
  choiceOpen.current = choice !== null;
  const announce = useRef(false);
  const lastRun = useRef(0);
  /** the decrypted refresh token, per stored ciphertext; dropped when the vault locks */
  const tokens = useRef<{ key: string; refreshToken: string; source: TokenSource } | null>(null);

  useEffect(() => {
    if (!unlocked) tokens.current = null;
  }, [unlocked]);

  async function sourceFor(m: SyncMeta): Promise<TokenSource> {
    if (tokens.current?.key === m.refreshToken.ciphertext) return tokens.current.source;
    let refreshToken: string;
    try {
      refreshToken = await vaultRef.current.sync.decryptSecret(REFRESH_TOKEN_PURPOSE, m.refreshToken);
    } catch {
      if (!vaultRef.current.sync.current()) throw new LockedError();
      throw new DropboxError('The stored Dropbox sign-in can’t be read', 'auth');
    }
    const source = tokenSource(DROPBOX_APP_KEY, refreshToken);
    tokens.current = { key: m.refreshToken.ciphertext, refreshToken, source };
    return source;
  }

  function localSide(vaultId: string): LocalSide {
    return {
      vaultId,
      snapshot: () => {
        const current = vaultRef.current.sync.current();
        if (!current) throw new LockedError();
        return { file: current.file, version: current.version };
      },
      integrate: (remote) => vaultRef.current.sync.integrate(remote),
    };
  }

  const runOnce = useCallback(async (): Promise<void> => {
    if (busy.current) {
      again.current = true;
      return;
    }
    if (choiceOpen.current) return;
    const m = await readSyncMeta();
    const start = vaultRef.current.sync.current();
    if (!m || !start) return;
    busy.current = true;
    lastRun.current = Date.now();
    setRunning(true);
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const api = createDropboxClient(await sourceFor(m));
          const outcome = await runSync({ api, local: localSide(start.vaultId), lastSyncedRev: m.lastSyncedRev, dirty: start.version !== m.syncedVersion });
          if (outcome.kind === 'vault-replaced') {
            setChoice({ remote: outcome.remote, meta: outcome.meta });
          } else {
            await updateSyncMeta({ lastSyncedRev: outcome.meta.rev, syncedVersion: outcome.version, lastSyncedAt: new Date().toISOString() });
            if (announce.current) snackbarRef.current.show({ message: 'Synced with Dropbox' });
          }
          announce.current = false;
          setProblem(null);
          return;
        } catch (err) {
          if (err instanceof LockedError || !vaultRef.current.sync.current()) return;
          if (err instanceof DropboxError && err.kind === 'network') {
            if (!navigator.onLine) return; // "Not synced yet"; syncs when back online
            const delay = RETRY_DELAYS_MS[attempt];
            if (delay !== undefined) {
              await sleep(delay);
              continue;
            }
          }
          setProblem(problemFor(err));
          return;
        }
      }
    } finally {
      busy.current = false;
      setRunning(false);
      if (again.current) {
        again.current = false;
        void runOnce();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Stores a new Dropbox sign-in (encrypted refresh token) and syncs. */
  const establish = useCallback(async (p: PendingConnection) => {
    const v = vaultRef.current;
    const refreshToken = await v.sync.encryptSecret(REFRESH_TOKEN_PURPOSE, p.tokens.refreshToken);
    const previous = await readSyncMeta();
    const sameAccount = previous?.accountId === p.tokens.accountId;
    await writeSyncMeta({
      accountId: p.tokens.accountId,
      email: p.email,
      refreshToken,
      lastSyncedRev: p.base?.rev ?? (sameAccount ? previous.lastSyncedRev : null),
      syncedVersion: p.base?.version ?? (sameAccount ? previous.syncedVersion : null),
      lastSyncedAt: p.base ? new Date().toISOString() : sameAccount ? previous.lastSyncedAt : null,
    });
    tokens.current = { key: refreshToken.ciphertext, refreshToken: p.tokens.refreshToken, source: tokenSource(DROPBOX_APP_KEY, p.tokens.refreshToken, p.tokens) };
    setProblem(null);
    announce.current = !p.base;
    if (p.base) snackbarRef.current.show({ message: 'Synced with Dropbox' });
    await runOnce();
  }, [runOnce]);

  // ---------- returning from Dropbox's sign-in page ----------
  useEffect(() => {
    void completeSignIn().then((result) => {
      setRedirectHandled(true);
      if (!result) return;
      if (result.purpose === 'join') {
        setJoinResult(result);
        return;
      }
      if (result.kind === 'ok') setPending({ tokens: result.tokens, email: result.email });
      else if (result.kind === 'cancelled') snackbarRef.current.show({ message: 'You cancelled the Dropbox sign-in. Nothing was changed.', icon: 'info' });
      else snackbarRef.current.show({ message: result.message, icon: 'info' });
    });
  }, []);

  // a waiting sign-in is stored as soon as the vault is unlocked
  useEffect(() => {
    if (!unlocked || !pending) return;
    setPending(null);
    void establish(pending).catch(() => snackbarRef.current.show({ message: 'PassMan couldn’t store the Dropbox connection. Please connect again.', icon: 'info' }));
  }, [unlocked, pending, establish]);

  // ---------- triggers ----------
  const connected = meta !== undefined && meta !== null;
  useEffect(() => {
    if (unlocked && connected) void runOnce();
  }, [unlocked, connected, runOnce]);

  const dirty = connected && vault.fileVersion !== null && vault.fileVersion !== meta.syncedVersion;
  useEffect(() => {
    if (!unlocked || !dirty) return;
    const timer = setTimeout(() => void runOnce(), AFTER_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [unlocked, dirty, vault.fileVersion, runOnce]);

  useEffect(() => {
    if (!unlocked || !connected) return;
    const onOnline = () => {
      setOnline(true);
      void runOnce();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun.current > 30_000) void runOnce();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => void runOnce(), PERIODIC_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [unlocked, connected, runOnce]);

  // ---------- the "Dropbox already has a vault" choice ----------
  async function chooseDropboxVault(password: string) {
    if (!choice) return;
    busy.current = true;
    try {
      const refreshToken = tokens.current?.refreshToken;
      await vaultRef.current.sync.replaceWith(choice.remote, password);
      const current = vaultRef.current.sync.current();
      if (refreshToken && current) {
        const sealed = await vaultRef.current.sync.encryptSecret(REFRESH_TOKEN_PURPOSE, refreshToken);
        tokens.current = tokens.current && { ...tokens.current, key: sealed.ciphertext };
        await updateSyncMeta({ refreshToken: sealed, lastSyncedRev: choice.meta.rev, syncedVersion: fileVersion(choice.remote), lastSyncedAt: new Date().toISOString() });
      }
      setChoice(null);
      snackbar.show({ message: 'Synced with Dropbox' });
    } finally {
      busy.current = false;
    }
  }

  async function keepDeviceVault(): Promise<'ok' | 'changed'> {
    if (!choice) return 'ok';
    const m = await readSyncMeta();
    const current = vaultRef.current.sync.current();
    if (!m || !current) return 'ok';
    busy.current = true;
    try {
      const api = createDropboxClient(await sourceFor(m));
      const result = await api.upload(VAULT_PATH, encodeVault(current.file), { kind: 'update', rev: choice.meta.rev });
      if (!result.ok) return 'changed';
      await updateSyncMeta({ lastSyncedRev: result.meta.rev, syncedVersion: current.version, lastSyncedAt: new Date().toISOString() });
      setChoice(null);
      snackbar.show({ message: 'This device’s vault is now the one in Dropbox' });
      return 'ok';
    } finally {
      busy.current = false;
    }
  }

  async function disconnect() {
    const source = tokens.current?.source;
    tokens.current = null;
    await deleteSyncMeta();
    setProblem(null);
    setChoice(null);
    if (source) await revoke(source);
  }

  const chip: SyncState =
    !connected ? (pending ? 'syncing' : 'not-connected') :
    running ? 'syncing' :
    problem ? 'problem' :
    dirty ? (online ? 'syncing' : 'offline') :
    meta.lastSyncedRev === null ? (online ? 'syncing' : 'offline') :
    'synced';

  const api = useMemo<SyncApi>(() => ({
    chip,
    connection: connected ? { email: meta.email, lastSyncedAt: meta.lastSyncedAt } : null,
    running: running || pending !== null,
    dirty,
    problem,
    syncNow: () => void runOnce(),
    connect: () => beginSignIn('connect', '#/settings'),
    reconnect: () => beginSignIn('reconnect', window.location.hash || '#/settings'),
    disconnect,
    joinResult,
    redirectHandled,
    beginJoin: (options) => beginSignIn('join', '#/welcome/dropbox', options),
    clearJoinResult: () => setJoinResult(null),
    connectWhenUnlocked: setPending,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chip, connected, meta, running, pending, dirty, problem, runOnce, joinResult, redirectHandled]);

  return (
    <SyncContext.Provider value={api}>
      {children}
      {choice && unlocked && (
        <VaultChoiceSheet
          choice={choice}
          localLogins={vault.logins}
          onUseDropbox={chooseDropboxVault}
          onKeepDevice={keepDeviceVault}
          onCancel={() => void disconnect().then(() => snackbar.show({ message: 'Dropbox disconnected. This device’s vault is unchanged.', icon: 'info' }))}
        />
      )}
    </SyncContext.Provider>
  );
}
