# <App>: Scope

<App> is <what it is>, a **local-first PWA** for one user on one Android device.

Status: <planned | vX.Y.Z, describes the app as built>.

## Goals

1. **<The main job, e.g. "Log a … in a few seconds.">** Everything on that screen is optimised for speed.
2. **<The main insight the user wants.>**
3. <…>

## Hard constraints

- All data stays on the device in IndexedDB (Dexie). No cloud storage, accounts, authentication, server or synchronisation.
- The only data leaving the device is a backup file the user creates and stores himself (Dropbox, pCloud, ...).
- The app code is hosted on GitHub Pages (static files only). **No personal data is ever committed to the repo.**

## Non-goals

<Accounts, sync, multi-device, charts?, localisation, light theme, …>

## Conventions

- Money: <integer cents, `€1.492,76`> · Dates: calendar `YYYY-MM-DD`, display `Tue, 10-11-2026`.
- <What counts in totals, valid edge values (negative/zero), rounding.>
- Lookup lists (<names>): rename and hide; delete only while unused, with Undo. Names unique ignoring case and accents.
- Dark theme only, shared design system (`docs/design-system.md`).

## Navigation

Bottom navigation with <N> tabs: **<Home, …, Setup>**. Forms (`/<x>/new`, `/<x>/:id`) open full screen without the bar.

## Screens

### Home (`/`)
- <cards and figures; first-run state with "Restore a backup"; backup status line>

### <Entry form> (`/<x>/new`, `/<x>/:id`)
- Fields: <…>. Required: <…>. Defaults: <…>.
- Save always reachable; disabled with a one-line hint until valid. Delete with Undo.

### <List> (`/<x>`)
- Grouped by <month>, sticky headers with totals, infinite scroll. Filters: <…>. Search: accent-insensitive.
- Selection mode (long-press a row) with a total bar.

### Setup (`/setup`)
- Lists: <…> (add, rename, hide, delete unused).
- Settings: <…>, backup reminder (days, default 14).
- Storage: record counts, storage estimate, persistent-storage status with a request button.
- Backup: last backup, **Export backup** (share sheet → cloud drive, falls back to download), <Export CSV>, **Restore from backup**.
- App version.

## PWA behaviour

Installable, fully offline after the first load, **Update available** dialog with Ignore / Reload (never silent updates). Long-press shortcut **<main action>** on the app icon.
