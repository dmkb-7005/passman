import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearCopiedSecret } from '../app/clipboard';
import { deriveKeyInWorker } from '../crypto/kdfWorkerClient';
import {
  changePassword as rekeyPassword,
  createVault,
  openWithPassword,
  openWithRecoveryKey,
  replaceRecoveryKey,
  resetPasswordWithRecoveryKey,
  sealPayload,
  type VaultFile,
  type VaultSession,
} from '../crypto/vaultFile';
import { db } from '../db/db';
import { withDefaults } from '../db/meta';
import { lockReason as computeLockReason } from '../domain/autolock';
import {
  createLogin,
  deleteLogin as toTombstone,
  isLogin,
  liveLogins,
  PAYLOAD_SCHEMA_VERSION,
  restoreLogin,
  sortLogins,
  updateLogin as applyUpdate,
  upsertEntry,
  type Entry,
  type Login,
  type LoginInput,
} from '../domain/logins';

/*
 * The unlocked vault lives here, in memory only (docs/ARCHITECTURE.md §2.2). IndexedDB keeps just the encrypted
 * vault file. Locking drops the key and every decrypted login.
 */

export type VaultStatus = 'loading' | 'empty' | 'locked' | 'unlocked';
export type LockInfo = { kind: 'idle'; minutes: number } | { kind: 'background' } | { kind: 'manual' } | null;

export interface PendingVault {
  session: VaultSession;
  recoveryKey: string;
  createdAt: Date;
}

interface VaultApi {
  status: VaultStatus;
  /** why the vault was locked (shown on Unlock); null on a fresh start */
  lockInfo: LockInfo;
  /** live logins, sorted; empty unless unlocked */
  logins: Login[];
  unlock: (password: string) => Promise<void>;
  /** Create step 2: derives the keys; nothing is stored until commitVault. */
  prepareVault: (password: string) => Promise<PendingVault>;
  commitVault: (pending: PendingVault) => Promise<void>;
  /** Recover step 1: throws InvalidRecoveryKeyError / WrongSecretError. */
  checkRecoveryKey: (recoveryKey: string) => Promise<void>;
  /** Recover step 2: new master password, then unlocked. */
  recover: (recoveryKey: string, newPassword: string) => Promise<void>;
  lock: (info?: LockInfo) => void;
  addLogin: (input: LoginInput) => Promise<Login>;
  updateLogin: (id: string, input: LoginInput) => Promise<Login>;
  /** Deletes and returns the undo action. */
  deleteLogin: (id: string) => Promise<() => Promise<void>>;
  changePassword: (current: string, next: string) => Promise<void>;
  /** Settings › New recovery key: nothing changes until commitRecoveryKey. */
  prepareRecoveryKey: (password: string) => Promise<{ file: VaultFile; recoveryKey: string; createdAt: Date }>;
  commitRecoveryKey: (file: VaultFile) => Promise<void>;
}

const VaultContext = createContext<VaultApi | null>(null);

export function useVault(): VaultApi {
  const api = useContext(VaultContext);
  if (!api) throw new Error('useVault outside VaultProvider');
  return api;
}

const derive = deriveKeyInWorker;

async function readFile(): Promise<VaultFile | null> {
  return ((await db.vault.get('current'))?.file as VaultFile | undefined) ?? null;
}

async function writeFile(file: VaultFile): Promise<void> {
  await db.vault.put({ key: 'current', file });
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [lockInfo, setLockInfo] = useState<LockInfo>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const session = useRef<VaultSession | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    void readFile().then((file) => setStatus(file ? 'locked' : 'empty'));
  }, []);

  const open = useCallback((s: VaultSession, list: Entry[]) => {
    session.current = s;
    entriesRef.current = list;
    setEntries(list);
    setLockInfo(null);
    setStatus('unlocked');
  }, []);

  const lock = useCallback((info: LockInfo = { kind: 'manual' }) => {
    if (!session.current) return;
    session.current = null;
    entriesRef.current = [];
    setEntries([]);
    clearCopiedSecret();
    setLockInfo(info);
    setStatus('locked');
  }, []);

  /** Runs vault writes one after another, so a save never overwrites a password change (or the reverse). */
  const serial = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  /** Serialised save: apply `change` to the current entries, encrypt, store. */
  const mutate = useCallback(<T,>(change: (list: Entry[]) => { list: Entry[]; result: T }): Promise<T> =>
    serial(async () => {
      const s = session.current;
      if (!s) throw new Error('The vault is locked');
      const { list, result } = change(entriesRef.current);
      const file = await sealPayload(s, { schemaVersion: PAYLOAD_SCHEMA_VERSION, logins: list });
      await writeFile(file);
      if (session.current !== s) return result; // locked meanwhile: saved, but not shown
      s.file = file;
      entriesRef.current = list;
      setEntries(list);
      return result;
    }), [serial]);

  const api = useMemo<VaultApi>(() => {
    const findLogin = (list: Entry[], id: string): Login => {
      const found = list.find((e) => e.id === id);
      if (!found || !isLogin(found)) throw new Error('Login not found');
      return found;
    };
    return {
      status,
      lockInfo,
      logins: sortLogins(liveLogins(entries)),
      unlock: async (password) => {
        const file = await readFile();
        if (!file) throw new Error('No vault on this device');
        const opened = await openWithPassword(file, password, derive);
        open(opened.session, opened.payload.logins);
      },
      prepareVault: async (password) => {
        const created = await createVault(password, derive);
        return { session: created.session, recoveryKey: created.recoveryKey, createdAt: new Date() };
      },
      commitVault: async (pending) => {
        await writeFile(pending.session.file);
        open(pending.session, []);
      },
      checkRecoveryKey: async (recoveryKey) => {
        const file = await readFile();
        if (!file) throw new Error('No vault on this device');
        await openWithRecoveryKey(file, recoveryKey, derive);
      },
      recover: async (recoveryKey, newPassword) => {
        const file = await readFile();
        if (!file) throw new Error('No vault on this device');
        const updated = await resetPasswordWithRecoveryKey(file, recoveryKey, newPassword, derive);
        const opened = await openWithRecoveryKey(updated, recoveryKey, derive);
        await writeFile(updated);
        open(opened.session, opened.payload.logins);
      },
      lock,
      addLogin: (input) =>
        mutate((list) => {
          const login = createLogin(input, new Date());
          return { list: [...list, login], result: login };
        }),
      updateLogin: (id, input) =>
        mutate((list) => {
          const login = applyUpdate(findLogin(list, id), input, new Date());
          return { list: upsertEntry(list, login), result: login };
        }),
      deleteLogin: (id) =>
        mutate((list) => {
          const login = findLogin(list, id);
          const tombstone = toTombstone(login, new Date());
          const undo = () =>
            mutate((current) => {
              const now = current.find((e) => e.id === id);
              // only undo if nothing else changed this login meanwhile
              if (!now || isLogin(now) || now.updatedAt !== tombstone.updatedAt) return { list: current, result: undefined };
              return { list: upsertEntry(current, restoreLogin(login, tombstone, new Date())), result: undefined };
            });
          return { list: upsertEntry(list, tombstone), result: undo };
        }),
      changePassword: (current, next) =>
        serial(async () => {
          const s = session.current;
          if (!s) throw new Error('The vault is locked');
          const file = await rekeyPassword(s.file, current, next, derive);
          await writeFile(file);
          s.file = file;
        }),
      prepareRecoveryKey: async (password) => {
        const s = session.current;
        if (!s) throw new Error('The vault is locked');
        const result = await replaceRecoveryKey(s.file, password, derive);
        return { ...result, createdAt: new Date() };
      },
      commitRecoveryKey: (file) =>
        serial(async () => {
          const s = session.current;
          if (!s) throw new Error('The vault is locked');
          // keep the newest payload, take the new keyset
          const merged: VaultFile = { ...s.file, keyset: file.keyset };
          await writeFile(merged);
          s.file = merged;
        }),
    };
  }, [status, lockInfo, entries, open, lock, mutate, serial]);

  useAutoLock(status === 'unlocked', lock);

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>;
}

/** Auto-lock (SCOPE §5.2): idle time and time in the background, from the settings on this device. */
function useAutoLock(active: boolean, lock: (info: LockInfo) => void) {
  useEffect(() => {
    if (!active) return;
    let lastActivity = Date.now();
    let hiddenSince: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
    let settings = withDefaults(undefined);
    let cancelled = false;
    void db.meta.get('settings').then((row) => {
      if (!cancelled) settings = withDefaults(row?.value);
    });
    const settingsWatch = setInterval(() => {
      void db.meta.get('settings').then((row) => {
        if (!cancelled) settings = withDefaults(row?.value);
      });
    }, 5000);

    const check = () => {
      const reason = computeLockReason({
        now: Date.now(),
        lastActivity,
        hiddenSince,
        idleMinutes: settings.lockIdleMinutes,
        backgroundSeconds: settings.lockBackgroundSeconds,
      });
      if (reason === 'idle') lock({ kind: 'idle', minutes: settings.lockIdleMinutes });
      if (reason === 'background') lock({ kind: 'background' });
    };
    const onActivity = () => {
      lastActivity = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now();
        if (settings.lockBackgroundSeconds === 0) lock({ kind: 'background' });
      } else {
        check();
        hiddenSince = null;
        lastActivity = Date.now();
      }
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true, capture: true });
    window.addEventListener('scroll', onActivity, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(settingsWatch);
      for (const e of events) window.removeEventListener(e, onActivity, { capture: true });
      window.removeEventListener('scroll', onActivity, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, lock]);
}
