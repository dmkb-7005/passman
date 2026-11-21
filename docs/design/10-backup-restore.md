# Design brief: Backup and restore

> Status: implemented in v0.6.0 (2026-11-21). Canvas: [PassMan · Backup and restore](https://claude.ai/artifact/KXt3s31mSCNmqzFG47M44d)
>
> Implementation note: restoring on Welcome with the recovery key continues in Recover's "Choose a new master password" step (the key is already accepted), because the backup's master password is unknown.

## Design system

> Use the established "Xpence night" design system: dark only, background `#1A1F2B` with the night-ridges gradient and mountain silhouettes behind tab screens; glass cards (`rgba(35,42,57,.72)`, 1 px `rgba(255,255,255,.06)` border, radius 20, blur); Inter for UI text, Space Grotesk tabular figures for numbers (hero 48 px bold); accent `#3D9BFF` with on-accent `#0B1A2E`; positive `#5FD4A0`, warn `#F2B34B`, danger `#FF8A90`; text `#E6EAF2` / `#B4BCCA` / muted `#9AA3B5`; pill chips 40–44 px, primary buttons 56 px full-width pills; bottom navigation with an accent pill on the active icon; bottom sheets with radius 24; snackbar with Undo. Portrait 390 × 844, touch targets ≥ 48 px, never colour alone. Reuse these styles; extend only where the screen needs something new.

Reuse the styles of the PassMan canvases: form layout with step indicator and pinned primary (Create vault, Recover, Import from Chrome), the master password field and the recovery key input (Unlock, Recover), fact boxes (Import summary, "Dropbox already has a vault"), the red primary ("Replace the vault in Dropbox"), the done hero (Import done). The **Settings › Backup card** (never / recent / overdue) is already designed and stays as it is. Every screen must look like the same app.

## Purpose

A backup is the encrypted vault file saved somewhere the user chooses (Google Drive, a USB stick, a laptop folder). It is the fallback when sync goes wrong: a login deleted or overwritten by mistake reaches every device within seconds, and Dropbox could become unavailable.

- **Export:** one tap in Settings, no extra screen.
- **Restore:** bring the logins back from a backup file. On a device with a vault (Settings) it **replaces all logins with the backup's logins**, as one change that syncs to the other devices. On a new device (Welcome) the backup becomes this device's vault.

How restore works (decided for v1): the master password, recovery key and Dropbox connection of the current vault **stay as they are**. Logins added since the backup are deleted, logins deleted since come back, edited logins go back to the backup's version. The other devices simply sync it; nobody has to enter anything. Before replacing, PassMan saves a copy of the current vault, so a restore can itself be undone by restoring that copy.

## Content

**1 · Export** (Settings › Backup › **Export backup**, no new screen)

- Android: opens the system share sheet with the file `passman-backup-2026-11-21.json.txt` (the user picks Drive, Files, …). Laptop: downloads it.
- Success snackbar: "Backup saved · Opens with your current master password or recovery key". The card then shows "Last backup today" (already designed).
- Share sheet closed without choosing: nothing changes, no snackbar.
- Design only the snackbar if it needs anything beyond the standard one. Optional: a small note in the card's hint if you think the "current password" point needs to be clearer.

**2 · Restore: choose file** (`#/restore`, form layout, back chevron, title "Restore from backup", "Step 1 of 3")

| Element | Required | Notes |
|---|---|---|
| Title "Choose a backup file" | yes | |
| Lead | yes | "Pick a PassMan backup (passman-backup-….json.txt)." |
| Warn note (Settings only) | yes | "Restoring replaces all 182 logins on this device with the ones in the backup. Your other devices get the same logins at their next sync." (last sentence only when Dropbox is connected) |
| Info line (Welcome only) | yes | "The backup becomes this device's vault. It opens with the master password or recovery key that were current when it was made." |
| **Choose backup file** | yes | Primary, pinned, file icon |
| Error state | yes | Error note naming the file, e.g. "**Notes.txt** isn't a PassMan backup." / "**passman-backup-….json.txt** was made by a newer version of PassMan. Update PassMan first." Button becomes **Choose another file** |

**3 · Restore: unlock the backup** ("Step 2 of 3")

Shown when the backup can't be opened with the current vault key: always on Welcome; from Settings only when the backup belongs to a different vault (e.g. made before the vault was re-created). A backup of the current vault opens without asking and goes straight to 4.

| Element | Required | Notes |
|---|---|---|
| Title "Unlock the backup" | yes | |
| File line | yes | Muted, file icon: "passman-backup-2026-11-14.json.txt" |
| Lead | yes | "Enter the master password that was current when this backup was made." |
| Master password field | yes | As on Unlock, error "Wrong master password" |
| Link "Use the recovery key instead" | yes | Switches the field to the recovery key input (as on Recover), link back "Use the master password instead". Error "This recovery key doesn't open this backup" |
| **Unlock backup** | yes | Pinned, "Unlocking…" state |

**4 · Restore: summary** ("Step 3 of 3", Settings only)

| Element | Required | Notes |
|---|---|---|
| Title "Replace all logins?" | yes | |
| Two fact boxes | yes | **Backup**: 175 logins, "Last change Sat, 14‑11‑2026" · **This vault now**: 182 logins, "Last change today 07:40" |
| What changes | yes | Short list with numbers: "9 logins added since the backup are removed" · "2 deleted logins come back" · "12 edited logins go back to the backup's version" · (zero lines are left out). If nothing differs: "The backup has the same logins as this vault." with the primary disabled or replaced by **Done** |
| Info note | yes | "PassMan first saves a copy of your current vault (passman-before-restore-2026-11-21.json.txt), so you can undo this by restoring that copy." |
| Sync line | optional | Muted cloud line: "Your other devices get the same logins at their next sync." |
| **Replace all logins** | yes | Red primary (as "Replace the vault in Dropbox"), "Restoring…" state |
| **Cancel** | yes | Text button under it |

**5 · Done** (Settings: "Step 3 of 3" completed; Welcome: after unlocking)

| Element | Required | Notes |
|---|---|---|
| Positive hero | yes | Check in a circle, "Restored 175 logins". Settings line: "9 removed · 2 back · 12 restored to the backup's version". Welcome line: "This is now this device's vault." |
| Safety copy line (Settings) | yes | File icon + "Copy of the previous vault saved: passman-before-restore-2026-11-21.json.txt" (muted; on Android it's in Downloads) |
| Welcome hint | yes | Info note: "To sync with your other devices, connect Dropbox in Settings." |
| **Go to my logins** | yes | Primary, pinned |

**6 · Leaving early:** no dialog needed (nothing changes before **Replace all logins**).

## Interactions

- Restore entry points: Settings › Backup › **Restore from backup** (already designed button) and Welcome › **Restore a backup file** (already designed link).
- The backup is read and decrypted in memory only. Auto-lock or leaving the screen drops it.
- Laptop: Enter = primary.

## States to design

- 1 Export snackbar (only if it differs from the standard snackbar).
- 2 Choose file: Settings variant (warn note); Welcome variant (info line); error "isn't a PassMan backup".
- 3 Unlock the backup: password (empty / wrong password); recovery key variant.
- 4 Summary with changes; summary "same logins".
- 5 Done: Settings variant; Welcome variant.

## Realistic sample data

Backup `passman-backup-2026-11-14.json.txt` with 175 logins, last change Sat, 14‑11‑2026 · 18:02. Current vault 182 logins, last change today 07:40. Differences: 9 added since (removed), 2 deleted since (come back), 12 edited since (go back). Safety copy `passman-before-restore-2026-11-21.json.txt`. "Today" is Saturday 21‑11‑2026, 08:00. Dropbox connected (alex.moreno@mail.example).

## Not wanted

- No list of the individual logins that change (numbers only).
- No partial restore or picking single logins from the backup.
- No unencrypted export, no automatic scheduled backups.
- No choice of file name or folder inside PassMan (the system share sheet / download handles that).

## Design decisions (from the canvas)

- **Header:** form header "Restore from backup" with back chevron (none on Done).
- **Steps:** from Settings "Step N of 3" (choose → unlock, only when needed → summary); from Welcome **"Step N of 2"** (choose → unlock), with matching segment bars. When Settings skips the unlock step, the summary still shows "Step 3 of 3".
- **1 Export:** standard snackbar above the nav with a positive check: "**Backup saved** · Opens with your current master password or recovery key". The Backup card's "Last backup today" state uses a positive archive icon circle and the date/time below. The card's hint is sharpened to: "The backup file is encrypted. It opens with the master password or recovery key **that are current when you save it**."
- **2 Choose file:** title, lead with the file pattern in Space Grotesk. Settings variant: warn note with bold warn lead "Restoring replaces all 182 logins on this device" + the sync sentence. Welcome variant: info note. Error: danger panel added under the note ("**Notes.txt** isn't a PassMan backup. Choose a file named passman-backup-….json.txt."); the button becomes **Choose another file**. Pinned primary with file icon.
- **3 Unlock the backup:** title + muted file line with file icon; lead; Unlock's password field and fixed error slot ("Wrong master password", dots kept and selected); underlined `--text-2` link "Use the recovery key instead" under the field; pinned **Unlock backup**, disabled while the field is empty. Recovery-key variant: Recover's two-line key field, lead "Enter the recovery key that was current when this backup was made.", error "This recovery key doesn't open this backup. Use the key that was current when it was made." (40 px slot), link "Use the master password instead".
- **4 Summary:** title + file line; two fact boxes on `--bg` (Backup 175 / This vault now 182, with last-change lines); "WHAT CHANGES" section label and a glass list with one row per non-zero change (icon + bold Space Grotesk number + text: minus-circle "logins added since the backup are removed", restore arrow "deleted logins come back", pencil "edited logins go back to the backup's version"); info note with the safety-copy file name in Space Grotesk; muted cloud sync line. Footer: red **Replace all logins** (`--danger` fill, dark text) + **Cancel** text button.
- **4 Same logins:** title "Nothing to restore", equal fact boxes, positive note "The backup has the same logins as this vault. There's nothing to restore."; footer is a plain accent **Done** (no red button).
- **5 Done (Settings):** 72 px positive check circle, "Restored 175 logins", line "9 removed · 2 back · 12 restored to the backup's version"; a small glass card with file icon "Copy of the previous vault saved", the file name (Space Grotesk) and "On Android it's in Downloads."; muted sync line; pinned **Go to my logins**.
- **5 Done (Welcome):** same hero with "This is now this device's vault." and the info note "To sync with your other devices, connect Dropbox in Settings."; pinned **Go to my logins**.
