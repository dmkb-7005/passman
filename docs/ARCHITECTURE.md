# PassMan: architecture

Status: **approved** (2026-11-20)

Follows `docs/PLAYBOOK.md` except where §1 says otherwise.

## 1. Deviations from the playbook

| Playbook rule | PassMan | Why |
|---|---|---|
| One Android phone | Phone, tablet (Chrome) and Windows laptop (Edge/Chrome) | Multi-device is the point of the app |
| No third-party requests; never call cloud APIs | Calls the **Dropbox API** (`api.dropboxapi.com`, `content.dropboxapi.com`) with an app-folder-only connection | Sync without a server; the spike showed it works from the browser and pCloud doesn't |
| Data in IndexedDB as plain tables; DB is the source of truth (`useLiveQuery`) | IndexedDB holds **only the encrypted vault file** + device metadata. Decrypted logins live **in memory** while unlocked | Nothing readable at rest |
| Backup = plain JSON; optional CSV export | Backup = the **encrypted** vault file; **no CSV export** | Secrets never leave encrypted |
| No import code in the app (one-off scripts in `tools/`) | **In-app Chrome CSV import** | Imported rows must go straight into the encrypted vault |
| No extra crypto libraries | **`hash-wasm`** for Argon2id (bundled WASM, offline) | WebCrypto has no memory-hard KDF |
| Restore = replace all from a plain file | Restore decrypts first, then replaces the vault locally and in Dropbox (new vault id) | See SCOPE §5.7 |
| `registerType: 'prompt'` + starter `UpdateBanner` | **Custom service worker** (`injectManifest`) that keeps serving the **approved build** until the user confirms; update dialog with build metadata | A standard waiting service worker activates on its own once the app is closed (§5.1) |

Everything else stays: Vite 6, React 19, TypeScript strict, HashRouter, Dexie 4, Zod 4, Vitest, `vite-plugin-pwa` with prompt-based updates, CSS Modules + the shared design system, GitHub Pages + Actions.

## 2. Security model

**Protects against:** loss or theft of a device while locked; anyone with access to the Dropbox account or a backup file; a curious browser extension reading IndexedDB.

**Does not protect against:** malware on an unlocked device; someone using the device while unlocked; a malicious build deployed through a compromised GitHub account, workflow or npm dependency. A browser always runs what the site serves, so the last one can only be made unlikely and noticeable, not impossible (§5.2). The CSP does not help there, because a malicious build ships its own `index.html`.

### 2.1 Keys
- **Vault key (DEK):** random 256-bit AES-GCM key, created once per vault, never changes in v1. Encrypts the logins.
- **Password key (KEK-P):** `Argon2id(masterPassword, salt)` → 256 bits. Parameters start at **m = 64 MiB, t = 3, p = 1**, are stored in the vault header and are checked on the phone (target 0.5–1 s). Runs in a **Web Worker** so the UI keeps responding.
- **Recovery key (RK):** 160 random bits, shown as 32 Crockford Base32 characters. **KEK-R** = `HKDF-SHA256(RK, salt, "passman/recovery/v1")`. HKDF is enough because the RK is fully random.
- The DEK is stored twice, **wrapped** (AES-GCM) with KEK-P and with KEK-R. Changing the password or recovery key only re-wraps the DEK.
- Unwrapped for normal use as a **non-extractable** `CryptoKey`. Re-wrapping (password change, new recovery key) unwraps it once more as extractable after re-entering the current password.
- AES-GCM with a fresh random 96-bit IV for every encryption. The payload is authenticated together with the header fields (`format`, `version`, `vaultId`) as additional data.

### 2.2 What is where

| Place | Content |
|---|---|
| Dropbox `Apps/PassMan/passman.vault` | Vault file (see DATA-MODEL §1): header + wrapped DEKs + encrypted payload |
| IndexedDB `vault` | The same vault file (latest local version) |
| IndexedDB `meta` | Device id, sync state, settings, Dropbox refresh token **encrypted with the DEK** |
| Memory while unlocked | DEK (non-extractable), decrypted logins |
| Memory while locked | Nothing secret |

JavaScript can't wipe strings from memory; locking drops every reference and relies on garbage collection. That's an accepted limitation of a web app.

## 3. Module layout

```text
src/
  main.tsx            fonts, global.css, ensureDefaults, storage.persist, OAuth redirect check, render
  app/                App.tsx (routes + lock gate), TabLayout, UpdateBanner, version.ts
  crypto/             pure crypto, no React
    bytes.ts            base64url, UTF-8, random bytes
    aes.ts              AES-256-GCM encrypt/decrypt, HKDF for the recovery key
    kdf.ts              Argon2id (hash-wasm), parameters and limits
    kdf.worker.ts       Argon2id in a worker; kdfWorkerClient.ts is the promise wrapper (browser only)
    recoveryKey.ts      generate, format, parse/normalise (Crockford)
    vaultFile.ts        create/open/seal the vault file, change password, reset with recovery key,
                        new recovery key, small secrets; Zod validation of header and payload
  domain/             pure logic, no React, no Dexie
    logins.ts           types + Zod schema, validation, edits, siteKey, search, sort, urlForOpening
    masterPassword.ts   master password rules
    merge.ts            merge(local, remote) per login, tombstones
    chromeCsv.ts        CSV parser (RFC 4180) + Chrome column mapping
    importPlan.ts       duplicates review and applying the decisions
    generator.ts        password generator
    autolock.ts         lock decisions from timestamps
  sync/               (sync milestone) dropboxAuth.ts, dropboxClient.ts, syncEngine.ts
  vault/
    VaultProvider.tsx   unlocked state in memory: create, unlock, recover, lock, add/edit/delete (+ undo),
                        change password, new recovery key; serialised writes; auto-lock (idle + background)
  db/                 Dexie: `vault` (encrypted file) and `meta` (settings, device state)
  app/                App.tsx (routes behind the vault gate), TabLayout (bottom bar / laptop rail),
                      UpdateProvider + UpdateDialog, clipboard.ts (copy + 30 s clearing), format.ts (dates)
  backup/             (backup milestone) export/share, restore
  features/           welcome (welcome, create, done), unlock (unlock, recover), logins (list, detail, edit,
                      generator sheet, sync chip), generator (tab + useGenerator), settings (+ password,
                      recovery key), shared tab-screen styles
  components/         icons, NightRidges, BottomSheet, Snackbar, form/ (fields, messages, dialogs,
                      PasswordText), generator/ (controls, strength), recovery/ (key panel + print sheet)
  styles/             global.css
```

There's no global state library: `VaultProvider` is a React context with a reducer. Dexie is used only for the two tables (no `useLiveQuery` for logins).

## 4. Main flows

### 4.0 Screens and the vault gate
`App.tsx` only routes to the screens of the current state: **empty** (Welcome, Create), **locked** (Unlock, Recover; any other address goes to Unlock and is opened after unlocking, e.g. the "Add login" shortcut) or **unlocked** (the tabs and forms). Reloading the page always starts locked.

### 4.1 Unlock
1. Read the vault file from IndexedDB → derive KEK-P in the worker → unwrap DEK → decrypt payload → validate with Zod → logins in memory.
2. A wrong password gives a GCM authentication failure, shown as "Wrong master password". There's no attempt limit (offline app); Argon2id makes guessing slow.
3. Start auto-lock timers; start a sync if Dropbox is connected.

### 4.2 Saving a change
Update the in-memory logins (set `updatedAt`; deletion → tombstone) → re-encrypt the whole payload → write the vault file to IndexedDB → mark `dirty` → debounced sync (3 s). A few hundred logins re-encrypt in milliseconds.

### 4.3 Sync
One sync at a time (`navigator.locks`, also across tabs).

```text
meta = get_metadata(/passman.vault)
  not found  → upload(mode: add) → store rev
  rev == lastSyncedRev and not dirty → done
  rev == lastSyncedRev and dirty      → upload(mode: update(rev))
  rev != lastSyncedRev → download → check vaultId and keys (see below)
                       → merged = merge(local, remote)
                       → save merged locally
                       → if merged != remote: upload(mode: update(remote rev))
upload returns 409 conflict → start again (max 3 times, then "Sync problem")
success → lastSyncedRev = new rev, dirty = false, lastSyncAt = now
```

- **Integrity:** every download is checked against Dropbox's `content_hash`.
- **Key changes:** the header carries `keysetId` and `keysetUpdatedAt`. If they differ, the newer keyset is kept (password changed or new recovery key on another device). The DEK is the same, so the open session continues.
- **Different `vaultId`** (vault replaced by a restore on another device): stop syncing and ask "Your vault was replaced on another device. Load it?" → then enter that vault's password.
- **Tokens:** the access token (4 h) is kept in memory only; the refresh token is stored encrypted and refreshed when needed (confirmed in the spike).
- **Offline / errors:** the status shows it; the next trigger retries. No data is lost because the local vault is always saved first.

### 4.4 Dropbox sign-in
PKCE with `token_access_type=offline`. Redirect URI = the app's base URL (`https://<owner>.github.io/passman/`). `main.tsx` handles `?code=…&state=…` before the router starts, swaps it for tokens, stores the refresh token encrypted, and cleans the URL. The verifier and state live in `sessionStorage` during the round trip. Sign-in is only offered while unlocked, so the token can be encrypted straight away.

### 4.5 Import
Parse CSV in memory (handles BOM, CRLF, quoted commas, line breaks inside quotes) → map columns → find duplicates against the vault and within the file → review screen → apply as normal changes (one save, one sync). The file contents are never stored.

### 4.6 Auto-lock
Pointer, key and scroll events update `lastActivity`. `visibilitychange` records when the app went to the background; on return, the elapsed time decides. The decision is computed from timestamps (`domain/autolock.ts`), because timers are throttled in the background.

## 5. PWA, hosting and updates
As in the playbook: precache the app shell, `navigator.storage.persist()`, version shown in Settings. The Argon2 WASM is precached. The manifest shortcut is **Add login**. The manifest uses `orientation: any` (tablet and laptop), not `portrait`.

### 5.1 Approved-build gate (custom service worker)
A normal "prompt" service worker isn't enough: the browser activates a waiting worker by itself as soon as every window of the app is closed. So PassMan's own worker (`src/sw.ts`, built with `vite-plugin-pwa` `strategies: 'injectManifest'`) works like this:

- Each build has a **build id** (commit SHA) and its own cache `passman-<buildId>` holding that build's precache list.
- The worker records the **approved build id** in its own Cache Storage entry (the worker never touches the app's IndexedDB). Every request is answered from the approved build's cache, whichever worker version is running.
- First install: the build is approved automatically.
- A new build installs in the background into its own cache and activates, but **keeps serving the approved build**. The running app asks the worker for `{ approved, pending }`, fetches the pending build's `version.json` and shows the Update dialog (SCOPE §5.8).
- **Update now** → message `approve(pendingBuildId)` → the worker switches, deletes old caches → reload. **Later** → nothing changes; asked again at the next start (a reload counts as a start).
- If the browser has evicted the approved build's cache, the worker can only serve the newest build; it then approves it and the app shows "Updated to …".
- Verified end to end in headless Chrome (build A installed, build B deployed: A keeps running through Later, reload and restart; B only after Update now; offline start works).
- Unit tests cover the gate logic (approve, ignore, two pending builds in a row, missing cache).

### 5.2 Build metadata and deploy hardening
- The deploy workflow writes `version.json` next to `index.html`: `version`, `buildId` (full SHA), `commitMessage` (first line), `commitAuthor`, `committedAt`, `deployedAt`, `deployedBy` (`GITHUB_ACTOR`), `runUrl`. The same data is compiled into the bundle for Settings.
- The dialog's **View on GitHub** opens `runUrl` / the commit: GitHub's own record of who pushed what.
- **What this protects against:** accidental or unwanted updates, and noticing a deploy you didn't make. **What it doesn't:** a malicious build replaces `sw.ts` too and can skip the gate. On the web, only the measures below make that unlikely:
  - GitHub account with a **passkey or security key** as 2FA; no long-lived personal access tokens; review authorised OAuth apps.
  - The `github-pages` deployment environment with **required reviewer = you**, so every deploy waits for your approval in GitHub (and you get a notification).
  - Actions pinned to commit SHAs; few dependencies; `npm ci` with the committed lockfile; `npm audit --omit=dev` clean.
  - A malicious build only gets secrets if you unlock in it. If an update dialog shows a commit you don't recognise, choose Later, don't unlock, and check GitHub.
- Full protection would need a native app with signed releases (e.g. a Tauri shell later). That is out of scope for v1.

## 6. Content Security Policy
Set as a `<meta http-equiv>` tag in `index.html` (GitHub Pages can't send headers):

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self';
connect-src 'self' https://api.dropboxapi.com https://content.dropboxapi.com;
img-src 'self' data:; style-src 'self'; font-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'
```
Plus `<meta name="referrer" content="no-referrer">`. If Vite's build needs `'unsafe-inline'` for styles, it gets documented here. Dropbox sign-in is a full-page navigation, so `connect-src` doesn't need `www.dropbox.com`.

## 7. Testing
- `crypto/`: Argon2id reference vector; create/open round trip; wrong password and tampered header or payload fail; recovery-key path; re-key keeps the DEK; recovery-key parsing (case, dashes, O/0, I/L/1); NFC passwords; absurd KDF parameters rejected. The worker was also checked in Chrome under the CSP (reference vector, ~0.4 s for 64 MiB / 2 passes on the build machine).
- `domain/`: merge (edit vs edit, edit vs delete both ways, new on both sides, identical); duplicates (host vs name, `www.`, `android://` app URLs, case and accents); CSV edge cases; generator (length, each class present, no look-alikes, only allowed characters); auto-lock decisions.
- `sync/`: sync engine with a fake Dropbox (first upload, no change, remote changed, local dirty, 409 then retry, vault replaced, offline).
- Manual: Argon2 timing on the phone; full flows on all three devices (checklist in the playbook §11 plus sync between two devices, offline edit then sync, recovery).
