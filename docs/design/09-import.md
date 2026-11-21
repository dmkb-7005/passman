# Design brief: Import from Chrome

> Status: implemented in v0.5.0 (2026-11-21). Canvas: [PassMan · Import from Chrome](https://claude.ai/artifact/Cw8ApxE6Z4MHuTpuprGvnK)
>
> Sample-data change: the "twice in the file" example is **Banco Sabadell · bancsabadell.com** instead of an Android app entry, because PassMan stores no app logins.
>
> Implementation note: the review lists undecided duplicates first (then by row); the order stays fixed while deciding, so cards don't jump.

## Design system

> Use the established "Xpence night" design system: dark only, background `#1A1F2B` with the night-ridges gradient and mountain silhouettes behind tab screens; glass cards (`rgba(35,42,57,.72)`, 1 px `rgba(255,255,255,.06)` border, radius 20, blur); Inter for UI text, Space Grotesk tabular figures for numbers (hero 48 px bold); accent `#3D9BFF` with on-accent `#0B1A2E`; positive `#5FD4A0`, warn `#F2B34B`, danger `#FF8A90`; text `#E6EAF2` / `#B4BCCA` / muted `#9AA3B5`; pill chips 40–44 px, primary buttons 56 px full-width pills; bottom navigation with an accent pill on the active icon; bottom sheets with radius 24; snackbar with Undo. Portrait 390 × 844, touch targets ≥ 48 px, never colour alone. Reuse these styles; extend only where the screen needs something new.

Reuse the styles of the PassMan canvases: form layout with back chevron and pinned primary (Create vault, Recover, Use my vault from Dropbox), notes (info / warn / error), radio cards and fact boxes ("Dropbox already has a vault"), login rows (Logins list), the password text style with coloured digits and symbols (Login detail). Every screen must look like the same app.

## Purpose

Bring the user's existing passwords from Chrome into PassMan once (later maybe again), without creating a mess of duplicates and without leaving the unencrypted CSV lying around.

The user already has the exported and cleaned-up file (`Chrome Passwords.csv`, every password **unencrypted**). They pick it in PassMan, see what will happen, decide each duplicate, import, and are told to delete the file. The app gives no export instructions.

Entry point: Settings › Import › **Import from Chrome** (already designed). Route `#/import`, form layout, back chevron, title "Import from Chrome". The flow happens on the phone or the laptop; the result syncs to the other devices.

## Content

**1 · Start** (`#/import`)

| Element | Required | Notes |
|---|---|---|
| Step indicator "Step 1 of 3" | yes | Steps: choose file · review · done |
| Title "Import your Chrome passwords" | yes | |
| Lead | yes | One line: "Choose the passwords file exported from Chrome (.csv)." No export instructions: the user prepares the file beforehand |
| Warn note | yes | "The file contains all your passwords unencrypted. Delete it as soon as the import is done." |
| Info line | yes | "The file is read on this device only. Nothing is uploaded." |
| **Choose CSV file** | yes | Primary, pinned. Opens the system file picker |
| Error state | yes | Error note in place of the info line, e.g. "This doesn't look like a Chrome passwords export." / "This file is empty." / "PassMan couldn't read this file." The same button picks another file |

**2 · Summary** ("Step 2 of 3", after reading the file; instant for a few hundred rows)

| Element | Required | Notes |
|---|---|---|
| Title "Ready to import" | yes | |
| File line | yes | Muted: "Chrome Passwords.csv · 182 rows" |
| Three facts | yes | **168 new logins** (positive), **11 possible duplicates** (warn), **3 skipped** (muted). Big numbers, Space Grotesk |
| Skipped details | yes | Expandable or a short list: "Skipped 3 rows without a password: Old forum, Router, (no name)" |
| Notes line | optional | "24 Chrome notes are not imported (PassMan has no notes)." Only when there were notes |
| Primary | yes | With duplicates: **Review 11 duplicates**. Without: **Import 168 logins** |
| Secondary | yes | "Choose another file" text link |

**3 · Duplicates review** ("Step 2 of 3", the heart of this brief)

A duplicate = same site (URL host, or the name when there's no URL) **and** same username, either already in the vault or twice in the file. For each one the user picks **Keep existing**, **Use imported** or **Keep both**.

| Element | Required | Notes |
|---|---|---|
| Header line | yes | "11 duplicates · 7 decided" (live), plus a thin progress bar |
| Bulk action | yes | **Apply to all remaining** → small sheet with the three choices. Only affects undecided items |
| One card per duplicate | yes | See below. A scrolling list, not one screen per item: the list can be 50+ long |
| Pinned primary | yes | **Import** (disabled until every item is decided). Label counts the result: "Import 172 logins" |

Duplicate card:

| Element | Required | Notes |
|---|---|---|
| Site name + host | yes | "Amazon · amazon.de" |
| Username | yes | "alex.moreno@mail.example" |
| Two sides | yes | **In PassMan** (changed Wed, 18‑11‑2026) vs **From Chrome**. For a duplicate inside the file: **First in file** vs **Later in file** |
| Passwords | yes | Masked by default; one eye per card reveals both, in the password text style |
| Same / different badge | yes | "Same password" (positive, these start on Keep existing) or "Different password" (warn) |
| Choice | yes | Three options: **Keep existing** · **Use imported** · **Keep both**. Segmented control or three small radio pills; your call. Undecided cards are clearly marked |

Keep both = the imported one is added as a separate login (same name).

**4 · Importing / done** ("Step 3 of 3")

| Element | Required | Notes |
|---|---|---|
| Short progress state | optional | "Importing…" (re-encrypting takes well under a second, but show it if the canvas wants it) |
| Positive hero | yes | Check in a circle, "Imported 172 logins", line "168 new · 4 replaced · 7 kept as they were · 3 skipped" |
| **Delete the file now** card | yes | Warn style, the most prominent thing after the hero: "Chrome Passwords.csv still has all your passwords unencrypted. Delete it now, and empty the recycle bin on Windows." + where it usually is: "Android: Files › Downloads · Windows: Downloads folder" |
| Sync line | optional | Muted: "Your other devices get these logins at their next sync." (only if Dropbox is connected) |
| **Go to my logins** | yes | Primary, pinned |

**5 · Leaving early** (back chevron during review): dialog "Discard this import?" / "Nothing has been imported yet." with **Discard** (danger outline) and **Keep reviewing** (primary), as the existing dialogs.

## Interactions

- Nothing is written until **Import** is tapped. One save, one sync.
- The CSV text stays in memory only; leaving the screen or the vault locking (auto-lock) drops it, and the user starts again from step 1. The start screen doesn't need to explain this.
- After the import, a snackbar isn't needed (the done screen says it all).
- Laptop: Enter = primary, Esc = back (with the discard dialog in review).

## States to design

- 1 Start (default); 1 with error "This doesn't look like a Chrome passwords export."
- 2 Summary with duplicates; 2 without duplicates (primary "Import 168 logins").
- 3 Review: top of list with a mix of decided / undecided cards, one card with passwords revealed, one "First in file / Later in file" card; the "Apply to all remaining" sheet; all decided (Import enabled).
- 4 Done.
- 5 Discard dialog.

## Realistic sample data

File `Chrome Passwords.csv`, 182 rows: 168 new, 11 duplicates (7 with the same password, 4 different; 2 of the 11 are twice in the file), 3 skipped without a password, 24 notes ignored. Vault has 14 logins. Duplicate examples: Amazon · amazon.de · alex.moreno@mail.example (different password; in PassMan changed Wed, 18‑11‑2026); Netflix · netflix.com · alex.moreno@mail.example (same password); ~~Banking app · android app `com.bank.mobile`~~ Banco Sabadell · bancsabadell.com · alexmoreno (twice in the file). Result: 168 new · 4 replaced · 7 kept · 3 skipped = "Imported 172 logins".

## Not wanted

- No column mapping UI (Chrome's columns are fixed; other password managers are out of scope).
- No editing of rows during the review (edit afterwards in PassMan).
- No preview list of all 168 new logins.
- No CSV export or "keep the file" option.

## Design decisions (from the canvas)

- **Header and steps:** form header "Import from Chrome" with back chevron (none on Done); "Step N of 3" with three segment bars, as on Create.
- **1 Start:** title, lead, warn note (bold warn "The file contains all your passwords unencrypted." + rest), info line with a muted device icon; pinned **Choose CSV file** with a file icon. **Error:** a danger error panel replaces the info line and names the picked file ("**Notes.csv** doesn't look like a Chrome passwords export. Choose the file Chrome exported."); the button becomes **Choose another file**.
- **2 Summary:** title + muted file line with file icon ("Chrome Passwords.csv · 182 rows", numbers in Space Grotesk). Three glass fact boxes in a row: number Space Grotesk 30 px 700 in positive / warn / muted, word below in `--text-2` ("new logins", "possible duplicates", "skipped"); without duplicates the middle box shows a muted "0 duplicates". Skipped rows as a small glass card ("Skipped 3 rows without a password" + muted list). Notes as an info note. Pinned primary (**Review 11 duplicates** / **Import 168 logins**) with the accent text link **Choose another file** below.
- **3 Review, top:** progress line "11 duplicates · 7 decided" (numbers Space Grotesk) with a `surface-2` **Apply to all remaining** pill (40 px) next to it; 4 px progress bar (accent; positive and full when all are decided, and the "N decided" text turns positive). The button is hidden when nothing is left to decide.
- **Duplicate card** (radius 20, padding 14):
  - Line 1: **name** · host (muted), eye button on the right (reveals/hides both passwords).
  - Line 2: username (muted) left; badge right: "Same password" (positive, check icon) or "Different password" (warn, ≠ icon).
  - Two side-by-side boxes on `--bg` (radius 12): label ("In PassMan" / "From Chrome", or "First in file" / "Later in file"), muted meta ("Changed Wed, 18‑11‑2026" / "In the file", or "Row 23" / "Row 141"), password as 10 dots or revealed in the coloured password style.
  - **Segmented control** (44 px track on `--bg`, three equal options): Keep existing · Use imported · Keep both; selected = accent fill, on-accent text 600.
  - **Undecided:** dashed 1.5 px `--border-dashed` outline instead of the glass border, plus a muted "Not decided yet" line with an empty-ring icon above the control; no option selected.
- **Pinned footer in review:** fixed 22 px line above the button: while undecided, muted "Decide 4 more to import." with a disabled **Import**; when all are decided, positive "All duplicates decided." and **Import 172 logins**.
- **Apply to all remaining sheet:** handle, title + close, "4 duplicates aren't decided yet. Pick one choice for all of them. Decided cards stay as they are, and you can still change any card afterwards."; three rows on a `--bg` group, each with an icon in an `--info-bg` circle, title and one-line description (Keep existing: "Nothing changes in PassMan." · Use imported: "Chrome's password replaces the one in PassMan." · Keep both: "The imported login is added next to the existing one.") and a chevron. Tapping a row applies it and closes the sheet (no separate confirm button).
- **5 Discard dialog:** warn icon in a circle, "Discard this import?" / "Nothing has been imported yet."; **Discard** danger-outlined, **Keep reviewing** accent primary.
- **4 Done:** check in a 72 px positive circle, "Imported 172 logins" (24 px), breakdown line with Space Grotesk numbers. **Delete the file now** card: `--warn-bg` with a 1.5 px translucent warn border, warn icon circle, title in warn (17 px 600), the brief's text with the file name in bold, then "WHERE IT USUALLY IS" (12 px uppercase muted) and two lines "**Android:** Files › Downloads", "**Windows:** Downloads folder". Muted sync line with a cloud icon. Pinned **Go to my logins**.
- No separate "Importing…" state drawn (re-encrypting is instant); if needed, reuse the turning-ring progress from Create step 2.
