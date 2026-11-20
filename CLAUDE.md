# PassMan

A minimal local-first password manager for logins only: one user, three devices (Android phone, Android tablet, Windows laptop), encrypted vault synced through the user's Dropbox.

## Read first

1. `docs/PLAYBOOK.md`: how all my local-first PWAs are built (stack, GitHub Pages, backup/restore, update dialog, process, TypeScript traps). Follow it unless this file or `docs/SCOPE.md` says otherwise.
2. `docs/design-system.md`: the shared dark design system. Every screen must look like the same family of apps.
3. `docs/SCOPE.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`: this app's plan.

## Project facts

- Repo: `dmkb-7005/passman`, served at `https://dmkb-7005.github.io/passman/` → Vite `base: '/passman/'`. Dropbox redirect URI = that URL.
- Main action (app shortcut + FAB): **Add login** → `./#/logins/new`.
- Vault file in Dropbox: `Apps/PassMan/passman.vault` (Dropbox app with **App folder** access).
- Backup file name: `passman-backup-YYYY-MM-DD.json.txt` (encrypted vault file).
- Language of UI copy: English.
- Legacy data to migrate: none. Existing passwords come in through the in-app Chrome CSV import.

## Deviations from the playbook

Full table and reasons in `docs/ARCHITECTURE.md` §1. In short:

- Three devices (Android phone, Android tablet, Windows laptop), not one phone.
- Calls the Dropbox API at runtime (app folder only) for sync. Everything sent is encrypted.
- IndexedDB stores only the encrypted vault file and device metadata; decrypted logins exist only in memory while unlocked.
- Backups are encrypted; there is no CSV export.
- In-app import of Chrome's CSV export.
- Extra dependency `hash-wasm` (Argon2id, run in a Web Worker).
- Strict CSP meta tag; see `docs/ARCHITECTURE.md` §6.
- Custom service worker with an **approved-build gate**: updates apply only after the user confirms, with build metadata from `version.json` (ARCHITECTURE §5).

## Security rules for every change

- Never write decrypted logins, the master password, the recovery key or the DEK to IndexedDB, localStorage, sessionStorage, logs or URLs.
- Don't add runtime dependencies or network destinations without asking; any new host must also go into the CSP.
- Crypto code lives in `src/crypto/` only, uses WebCrypto (+ `hash-wasm` for Argon2id) and is fully tested.

## How to hand over work

- Zip of changed files (unzips over the repo root) + a list of files to delete.
- I run `npm run typecheck && npm test && npm run build` before pushing, and test on the phone with the checklist you give me.
- new test line here
