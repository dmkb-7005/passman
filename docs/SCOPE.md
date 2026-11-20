# PassMan: scope

Status: **approved** (2026-11-20)

PassMan is a deliberately small password manager for **logins only**. It is local-first: the vault is encrypted on each device and synced as one encrypted file through the user's own Dropbox. One user, three devices: an Android phone, an Android tablet (Chrome) and a Windows laptop (Edge or Chrome), each with PassMan installed as a PWA.

Behaviour described here is binding. Anything not listed is out of scope.

## 1. What a login holds

| Field | Required | Notes |
|---|---|---|
| Name | yes | Site or app name, e.g. "Amazon", "Banking app" |
| URL | no | Shown as a link; used to recognise duplicates |
| Username or email | no | Some logins only have a password |
| Password | yes | |

Nothing else: no notes, cards, files, one-time codes (TOTP), tags or folders.

## 2. Features in scope

1. **Master password + recovery key.** The vault opens with the master password, or with the recovery key if the password is forgotten. The recovery key is shown once at setup and can be replaced later in Settings.
2. **Auto-lock.** Locks after a few minutes without use, and when the app has been in the background for a while (both adjustable). "Lock now" is always one tap away.
3. **Logins list** with instant search (name, URL, username), sorted alphabetically.
4. **Login detail**: copy username, copy password, show/hide password, open URL.
5. **Add, edit, delete** with Undo on delete.
6. **Password generator**, both as a tab and inside the add/edit form.
7. **Import from Chrome's CSV export**, with a duplicates review where the user decides each case.
8. **Dropbox sync** across the three devices, automatic and conflict-safe.
9. **Encrypted backup file** export and restore, for when Dropbox isn't available.
10. **Settings**: Dropbox connection, auto-lock times, change master password, new recovery key, backup/restore, import, persistent storage, version.

## 3. Out of scope

- Autofill into other apps or websites (not possible from a PWA). Copy and paste only.
- Fingerprint / Windows Hello unlock (may be added later).
- Notes, cards, attachments, TOTP, password history, sharing, several vaults.
- **Any unencrypted export** (no CSV export).
- Password health reports (weak or reused passwords).
- Other cloud providers (pCloud blocks downloads from web apps; see `claude/sync-spike-results.md`).
- A layout specific to tablets and laptops: v1 uses the shared single-column layout (max width 560 px, centred) on every device.

## 4. Screens and routes

Bottom navigation with three tabs: **Logins**, **Generator**, **Settings**. The screens before unlocking have no navigation.

| Screen | Route | Purpose |
|---|---|---|
| Welcome (first run) | `#/welcome` | Choose: **Create a new vault**, **Use my vault from Dropbox**, **Restore a backup file** |
| Create vault | `#/welcome/create` | Master password twice → recovery key shown → confirm it was saved → optionally connect Dropbox |
| Join from Dropbox | `#/welcome/dropbox` | Connect Dropbox → vault found → enter master password |
| Unlock | `#/unlock` | Master password; link "Forgot it? Use recovery key" |
| Recover | `#/recover` | Recovery key → set a new master password |
| Logins (tab) | `#/` | Search, list, FAB **Add login**; header shows sync status |
| Login detail | `#/logins/:id` | Copy, reveal, open URL, Edit |
| Add / edit login | `#/logins/new`, `#/logins/:id/edit` | Fields, **Generate** button (opens generator sheet), Delete (edit only) |
| Generator (tab) | `#/generator` | Generate and copy a password without creating a login |
| Import | `#/import` | Pick Chrome CSV → summary → duplicates review → import → "delete the CSV" reminder |
| Settings (tab) | `#/settings` | See §2.10 |
| Recovery key | `#/settings/recovery-key` | Generate a new recovery key (shown once, as at setup) |
| Change master password | `#/settings/password` | Current password, new password twice |

App shortcut (long-press on the icon): **Add login** → `./#/logins/new` (unlock first if locked).

## 5. Behaviour

### 5.1 Master password and recovery key
- Master password: at least **12 characters**. The form suggests a passphrase of several words. Typed twice when set.
- Recovery key: 32 characters in 8 groups of 4 (e.g. `7K3M-Q9TD-…`). The setup and new-key screens show it once with **Print** and **Copy**, and ask the user to type its last group to confirm it was saved. Typing ignores case, spaces and dashes.
- Forgot the password: **Recover** asks for the recovery key, then a new master password. The logins are untouched.
- Change master password: asks for the current password. Other devices keep accepting the old password until they next sync; after that they need the new one.
- New recovery key: asks for the master password; the old recovery key stops working once devices have synced.
- There is no other way back in. Losing both the master password and the recovery key means the vault is lost. Setup says this plainly.

### 5.2 Locking
- Locks after **5 minutes without interaction** (options: 1, 2, 5, 10, 30 min).
- Locks when the app has been in the background for **1 minute** (options: immediately, 30 s, 1 min, 5 min).
- Locking discards all decrypted data from memory and returns to Unlock. An unsaved edit form is lost on lock.
- Unlock opens straight from the local copy, without waiting for the network; sync then runs in the background.

### 5.3 Copying
- Copying shows a snackbar ("Password copied") and **clears the clipboard after 30 s** if PassMan is still in the foreground. If it isn't, the browser doesn't allow clearing, and the snackbar text says so: "Clears in 30 s while PassMan is open".

### 5.4 Password generator
- Length 8–64 (default **20**); lowercase, uppercase, digits, symbols (default all on); "avoid look-alikes" (`0 O 1 l I`) default on.
- Every selected character type appears at least once. Uses the browser's cryptographic random generator.
- Choices are remembered per device. **Regenerate** and **Copy**; in the form, **Use this password**.

### 5.5 Import from Chrome
1. User exports passwords in Chrome (Settings → Passwords → Export) and picks the CSV in PassMan.
2. Columns `name`, `url`, `username`, `password` are used; `note` is dropped (the summary says how many notes were ignored). Rows without a password are skipped and listed.
3. Summary: N new logins, M possible duplicates, K skipped.
4. **Duplicates review**: a duplicate is a login for the same site (URL host, or the name if there is no URL) with the same username, either already in the vault or appearing twice in the CSV. For each one the user chooses **Keep existing**, **Use imported** or **Keep both**. Identical pairs (same password too) start on "Keep existing". "Apply to all remaining" is available.
5. Import, then a reminder: **"Delete the CSV file now: it contains all your passwords unencrypted"**, including from Downloads and the recycle bin.

### 5.6 Sync (Dropbox)
- Connect once per device (Dropbox sign-in); the app then stays connected. **Disconnect** revokes access.
- PassMan only sees its own app folder in Dropbox (`Apps/PassMan/`). The file `passman.vault` there is fully encrypted.
- Sync runs on unlock, a few seconds after every change, and with **Sync now**. It needs the vault to be unlocked.
- Changes made offline are kept and synced later. The Logins header shows: Synced · Syncing… · Not synced yet (offline) · Sync problem (tap for details).
- Changes from two devices are merged login by login; the newer edit of a login wins. A deletion wins over an older edit and loses to a newer one.
- One device can never overwrite changes it hasn't seen (Dropbox rejects the upload; PassMan merges and retries).

### 5.7 Backup and restore
- **Export backup** shares or downloads `passman-backup-YYYY-MM-DD.json.txt`. It is the same encrypted file as in Dropbox and opens with the master password or the recovery key that were current at export time.
- Settings shows the last backup date (same rules as the playbook; reminder default 30 days).
- **Restore** (from Welcome or Settings): pick the file → enter its master password or recovery key → summary → red **Replace all logins**. A copy of the current encrypted vault is downloaded first. If Dropbox is connected, the restored vault replaces the Dropbox vault too, and the other devices are asked to load it again with its password.

### 5.8 Updates
- **An update is never applied without confirmation**: not when the page reloads, and not when the app is closed and reopened. PassMan keeps running the version you last approved.
- When a new version has been deployed, PassMan shows an **Update available** dialog with:
  - the new version number and the installed version
  - when it was deployed, and by which GitHub account
  - the commit it was built from (short id + first line of the commit message)
  - **View on GitHub**, a link to that commit and its deploy run, to check it really is yours.
  
  Buttons: **Later** (asks again at the next start) and **Update now**.
- After an update, a snackbar confirms "Updated to vX.Y.Z".
- Settings shows the installed version and its commit, plus **Check for updates**.
- Limitation: the dialog's details come from the new build itself. They help you notice an update you didn't make, but a malicious build could fake them, and the browser would still run it (see ARCHITECTURE §5.2).

## 6. Devices and platforms
- Android phone and tablet: Chrome, installed PWA. Windows laptop: Edge or Chrome, installed PWA.
- On the laptop: Enter submits forms, Esc closes sheets and dialogs, `/` focuses search.
- Fully offline after the first load, apart from Dropbox sync.

## 7. Status

- **v0.3.0 (vault screens):** create vault with recovery key (and print sheet), unlock, recover, auto-lock, logins list with search, detail, add/edit/delete with Undo, generator (tab and sheet), Settings with auto-lock times, change master password, new recovery key, storage and version. Laptop layout with a left rail from 900 px.
- **v0.4.0 (Dropbox sync):** connect in Settings, use the vault from Dropbox on a second device (Welcome), automatic sync with merge, sync chip and Settings card states, Sync now, Disconnect, sync problem sheet with Reconnect / Try again, "Dropbox already has a vault" choice.
- **Not yet:** backup export/restore, Chrome import. Their buttons are in place as designed and say "arrives in the next version of PassMan".

## 8. Decisions
- Approved 2026-11-20, including the defaults above (5 min idle / 1 min in background, 12-character minimum).
- Repo `dmkb-7005/passman`, served at `https://dmkb-7005.github.io/passman/`.
- Accent colour: the shared blue.
