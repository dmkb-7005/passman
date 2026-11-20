# Design brief: Dropbox sync screens

> Status: implemented in v0.4.0 (2026-11-20). Canvas: [PassMan · Dropbox sync](https://claude.ai/artifact/UrJqCX9Z428odroM9nw8yn)
>
> Deviation: the Dropbox fact box in sheet 2 says "Another vault" instead of a login count. That vault is encrypted with its own key, so its logins can't be counted before it is unlocked.

## Design system

> Use the established "Xpence night" design system: dark only, background `#1A1F2B` with the night-ridges gradient and mountain silhouettes behind tab screens; glass cards (`rgba(35,42,57,.72)`, 1 px `rgba(255,255,255,.06)` border, radius 20, blur); Inter for UI text, Space Grotesk tabular figures for numbers (hero 48 px bold); accent `#3D9BFF` with on-accent `#0B1A2E`; positive `#5FD4A0`, warn `#F2B34B`, danger `#FF8A90`; text `#E6EAF2` / `#B4BCCA` / muted `#9AA3B5`; pill chips 40–44 px, primary buttons 56 px full-width pills; bottom navigation with an accent pill on the active icon; bottom sheets with radius 24; snackbar with Undo. Portrait 390 × 844, touch targets ≥ 48 px, never colour alone. Reuse these styles; extend only where the screen needs something new.

Reuse the styles of the PassMan canvases (Welcome and Create vault, Unlock and Recover, Logins, Settings); every screen must look like the same app. The Settings Dropbox card (connected / not connected / sync problem) and the Logins sync chips are already designed and stay as they are.

## Purpose

Three moments that the existing canvases don't cover:

1. **Use my vault from Dropbox** (second and third device, from Welcome): connect Dropbox, find the vault, unlock it with the master password. Done once per device.
2. **Dropbox already holds a different vault** (connecting a device that already has its own vault, e.g. a test vault): the user must choose which vault to keep. Rare, but a wrong choice loses logins, so it must be very clear.
3. **Sync problem details** (tap on the "Sync problem" chip in Logins): what went wrong, and the one action that fixes it.

Routes: `#/welcome/dropbox` (form layout, back chevron, title "Use my vault from Dropbox"). The other two are a dialog and a bottom sheet over the current screen.

## Content

**1a · Connect** (`#/welcome/dropbox`, before signing in)

| Element | Required | Notes |
|---|---|---|
| Step indicator "Step 1 of 2" | yes | Same as Create / Recover |
| Title "Connect your Dropbox" | yes | |
| Explanation | yes | "Sign in to the Dropbox account where your other device keeps PassMan's vault. PassMan only sees its own folder there, and everything in it is encrypted." |
| **Continue to Dropbox** | yes | Primary, pinned. Leaves the app for Dropbox's sign-in page and comes back |
| Info note | yes | "First device? Go back and choose Create a new vault, then connect Dropbox in Settings." |

**1b · Looking for your vault** (after returning from Dropbox, ~1–3 s)

| Element | Required | Notes |
|---|---|---|
| Calm progress state | yes | Like Create step 2: icon in a turning ring, "Looking for your vault…", muted line "Connected to alex.moreno@mail.example" |

**1c · Vault found → unlock** ("Step 2 of 2")

| Element | Required | Notes |
|---|---|---|
| Positive badge "Vault found" | yes | Like "Recovery key accepted" |
| Title "Unlock your vault" | yes | |
| Meta line | yes | "Last changed Fri, 20‑11‑2026 · 22:48 in Dropbox (alex.moreno@mail.example)" |
| Master password field | yes | Same as Unlock; error slot "Wrong master password" |
| **Unlock** | yes | Pinned; "Unlocking…" state as on Unlock |
| Link "Forgot it? Use your recovery key" | yes | Opens the same Recover flow, but on the downloaded vault |

**1d · No vault in this Dropbox**

| Element | Required | Notes |
|---|---|---|
| Warn note | yes | "There's no PassMan vault in this Dropbox (alex.moreno@mail.example) yet." |
| Explanation | yes | "Connect Dropbox in Settings on the device that has your vault first, or start a new vault here." |
| **Use another Dropbox account** | yes | Secondary |
| **Create a new vault here** | yes | Text link (it becomes the vault in Dropbox) |

**1e · Errors**: Dropbox sign-in cancelled ("You cancelled the Dropbox sign-in. Nothing was changed."), offline ("PassMan can't reach Dropbox. Check the connection and try again." + **Try again**).

**2 · Dropbox already holds a different vault** (dialog, after connecting in Settings on a device that has its own vault)

| Element | Required | Notes |
|---|---|---|
| Warn icon in circle | yes | |
| Title "Dropbox already has a vault" | yes | |
| Text | yes | Two facts side by side or stacked: "This device: 14 logins, changed today 22:40" / "Dropbox: 182 logins, changed Wed, 18‑11‑2026" |
| Choice 1 | yes | **Use the vault in Dropbox**: "This device's 14 logins are replaced." (recommended for a second device) |
| Choice 2 | yes | **Keep this device's vault**: "The vault in Dropbox is replaced on all devices." (danger outline) |
| **Cancel** | yes | Nothing changes, Dropbox stays disconnected |

Choosing either asks for the master password of the vault being kept if it differs (only the Dropbox one: the device one is unlocked already). Design this as a radio-card choice inside a bottom sheet if a dialog is too small; your call.

**3 · Sync problem sheet** (bottom sheet from the chip)

| Element | Required | Notes |
|---|---|---|
| Head "Sync problem" + close | yes | |
| Status | yes | Danger icon + one plain sentence, e.g. "Dropbox rejected the sign-in." / "The vault in Dropbox changed in a way PassMan can't merge." |
| Reassurance | yes | "Your changes are kept on this device. Last synced Wed, 18‑11‑2026 · 21:06." |
| Primary action | yes | One of **Reconnect Dropbox** / **Try again** |
| Secondary | yes | "Open Settings" text link |

## Interactions

- Leaving for Dropbox and coming back reloads the app: the flow resumes at 1b automatically.
- When Dropbox sign-in returns to a device that already has a (locked) vault, the user unlocks first, then sees "Connecting Dropbox…" as the Settings card's syncing state (already designed).
- The "Synced" snackbar after a first successful sync: "Synced with Dropbox".

## States to design

- 1a Connect; 1b Looking; 1c Vault found (empty field), 1c wrong password; 1d No vault; 1e cancelled and offline.
- 2 Different vault: default; after choosing "Keep this device's vault" (confirm state, red primary "Replace the vault in Dropbox").
- 3 Sync problem sheet: rejected sign-in (Reconnect), network (Try again).

## Realistic sample data

Dropbox account alex.moreno@mail.example; Dropbox vault 182 logins, last changed Wed, 18‑11‑2026 · 21:06; this device 14 logins, changed today 22:40. "Today" is Friday 20‑11‑2026, 23:15.

## Not wanted

- No file browser or folder picker (the vault is always `Apps/PassMan/passman.vault`).
- No sync log, history or conflict list (merging is automatic).
- No Dropbox logo or brand colours (a plain cloud icon, as in Settings).

## Design decisions (from the canvas)

- **Form header** (all of flow 1): back chevron + "Use my vault from Dropbox"; no back chevron during the 1b progress state. Steps use "Step 1 of 2 / Step 2 of 2" with segment bars, like Recover.
- **1a Connect:** title, explanation, info note (accent icon, "Create a new vault" in bold); pinned **Continue to Dropbox** with a small external-link icon (it leaves the app).
- **1e cancelled:** shown on the Connect screen as a warn note ("You cancelled the Dropbox sign-in. Nothing was changed.") above the info note; the same pinned button retries.
- **1b Looking:** cloud icon in an `--info-bg` circle with a turning accent ring (same as Create step 2); "Looking for your vault…" + muted "Connected to alex.moreno@mail.example".
- **1e offline:** own screen, title "Couldn't reach Dropbox", "Signed in as alex.moreno@mail.example.", danger error panel with the brief's text; pinned **Try again**.
- **1c Vault found:** positive "Vault found" badge, title, muted meta line (time in Space Grotesk); Unlock's password field (label "Master password", eye, fixed 20 px error slot); recovery-key text link under the field; **Unlock** pinned at the bottom and disabled while the field is empty. Wrong password = danger border, dots kept and selected, "Wrong master password" with alert icon.
- **1d No vault:** title "No vault found", warn note, explanation; pinned full-width `surface-2` **Use another Dropbox account** (56 px, cloud icon) with the accent link **Create a new vault here** below it.
- **2 Different vault:** a **bottom sheet** over Settings (a dialog was too small). Warn icon in a circle + title; line "Only one vault can sync. Choose which one to keep."; two side-by-side fact boxes on `--bg` (label, login count in Space Grotesk 18 px 600, change date); two radio cards:
  - **Use the vault in Dropbox**: "This device's 14 logins are replaced.", accent radio, small `--info-bg` tag "Recommended for a second device". Selected by default; primary button **Use the vault in Dropbox**.
  - **Keep this device's vault**: title in danger, `--danger-border` outline (solid danger border + faint red tint when selected). Selecting it adds a warn note ("**182 logins in Dropbox will be replaced** by this device's 14 logins, on all your devices. This can't be undone.") and turns the primary into a **red** (`--danger` fill, dark text) **Replace the vault in Dropbox**.
  - **Cancel** text button always under the primary.
- **3 Sync problem sheet** (over the Logins list with the "Sync problem" chip): handle, head "Sync problem" + close; danger alert icon in a circle with the cause in 16 px 600 ("Dropbox rejected the sign-in." / "PassMan couldn't reach Dropbox after 3 tries."); reassurance line in `--text-2`; primary **Reconnect Dropbox** / **Try again**; accent text link **Open Settings**.
- Not drawn separately: the master password step after choosing "Use the vault in Dropbox" (reuse 1c), and the "Synced with Dropbox" snackbar (standard snackbar).
