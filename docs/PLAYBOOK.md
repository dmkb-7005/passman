# Local-first PWA playbook

How to build a personal, local-first Progressive Web App the way **Xpence v2** was built: React + TypeScript + Vite, data in IndexedDB on the phone, hosted on GitHub Pages, backed up to a cloud drive as a file the user shares. Every rule here was either a deliberate decision or a lesson from a real bug.

**For the AI agent:** read this whole file before planning. It overrides your defaults. Where the project's own `docs/SCOPE.md` says something different, the project wins and should say why. Files under `starter/` in this kit are proven code: copy them, don't rewrite them.

---

## 0. Starting from the starter

The repo was created from `starter/` (see the kit README). Before building features:

- Check the renames are done: `REPO` and manifest names in `vite.config.ts`, `<title>` in `index.html`, `APP_NAME`/`APP_VERSION` in `src/app/version.ts`, `APP_ID` in `src/backup/app.ts`, `name` in `package.json`.
- Replace the example tables (`categories`, `items`) in `src/db/schema.ts`, `DATA_TABLES`, `src/backup/schema.ts` (table schemas, integrity checks, `TABLE_LABEL`/`FIELD_LABEL`) and the table labels in `RestoreSheet.tsx`. Keep the generic parts.
- Set the bottom-nav tabs in `src/app/TabLayout.tsx` and the shortcut route in `vite.config.ts`.
- Replace the placeholder icons in `public/icons/` once the user has designed real ones: `icon.svg` (rounded), `icon-maskable.svg` (full bleed, content within the central 80 %), `apple-touch-icon.svg` (full bleed), `shortcut-add.svg`, rendered to `icon-192/512.png`, `icon-maskable-192/512.png`, `apple-touch-icon.png` (180), `favicon-32.png`, `shortcut-add-96/192.png`.

## 1. Hard constraints (non-negotiable unless the project says otherwise)

- **One user, one Android phone**, installed as a PWA from Chrome. Portrait, 360–412 px wide, must not break at 320 px.
- **All data stays on the device** in IndexedDB. No server, no accounts, no authentication, no sync, no analytics, no third-party requests at runtime.
- **The only data that leaves the phone is a backup file the user creates** and sends through the Android share sheet to his own cloud drive (Dropbox, pCloud, …). Never call cloud provider APIs.
- **Static hosting on GitHub Pages** from a public repo. The code is public; **personal data is never committed** (see §4).
- **Fully offline** after the first load, including fonts.
- **Dark theme only**, using the shared design system (§7). UI copy in English unless the project says otherwise.

## 2. How we work together (process)

1. **Ask before planning.** Ask the user every question whose answer changes the data model or a screen (edge cases in legacy data, what counts in totals, what is optional). Suggest alternatives where you see a simpler or more robust option. Batch questions; don't drip them.
2. **Write the plan as three docs and get them approved** before scaffolding: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md` (templates in `docs-templates/`). Behaviour in SCOPE is binding; screens are listed with routes.
3. **Scaffold first, deploy immediately.** Get an installable, offline, empty shell onto GitHub Pages and confirmed on the phone before building features. Hosting problems are cheapest to find with no features in the way.
4. **Pure logic first, with tests**: `domain/` and `backup/` before screens.
5. **Design pass per screen.** Write one design brief per screen (`docs/design/NN-screen.md`, template in `docs-templates/design/`), the user designs it in Claude Design, then you implement *that design*. Legacy screenshots show **functionality, not the look**. Never invent a new visual style; reuse the design system.
6. **Implement a screen, verify it against the design** (render it and compare), then hand over.
7. **The user verifies on the phone.** Give a short, concrete checklist of what to try (§11) after every change that touches device behaviour.
8. **Cleanup and docs at the end of each milestone**: remove dead code, rewrite the docs to describe what is built (not what was planned), mark design briefs as implemented, bump `APP_VERSION`.

### Handing over code

- Deliver changed files as a **zip that unzips over the repo root**, plus an explicit list of **files to delete** (a zip can't delete).
- **Never describe a config change in prose only** (package.json scripts, tsconfig, vite.config). Ship the file. A described-but-not-shipped `"migrate"` script caused a "Missing script" error once.
- If you can't run the full `tsc` (no network for `npm install` in your sandbox), say so plainly and ask the user to run **`npm run typecheck && npm test && npm run build`** before pushing. Your syntax check is not a typecheck: a real `tsc` caught a narrowing bug that a parser check passed (§8).
- Don't overwrite files the user changed himself (e.g. a dependency version he bumped): leave them out of the zip and say so.

## 3. Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite 6, React 19, TypeScript ~5.8 | `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` |
| Routing | React Router 7, **`HashRouter`** | Pages has no SPA fallback; deep links and the app shortcut use `#/…` |
| Storage | Dexie 4 + `dexie-react-hooks` | `useLiveQuery`: the DB is the single source of truth |
| Validation | Zod 4 | Backup restore. Keep code compatible with Zod 4 (`code: 'custom'`, no `issue.received`) |
| Dates | date-fns or small own helpers | Calendar dates as `YYYY-MM-DD` strings |
| Tests | Vitest (+ `fake-indexeddb` for DB tests) | `domain/` and `backup/` fully covered |
| PWA | `vite-plugin-pwa`, `registerType: 'prompt'` | Never auto-update (§6) |
| Styling | CSS Modules + CSS variables | No UI kit, no Tailwind |
| Fonts | `@fontsource/inter`, `@fontsource/space-grotesk` | Bundled and precached; no Google Fonts at runtime |
| Charts | none by default | Prefer typography, colour, badges, a thin range bar |

**Rejected on purpose:** global state libraries (Redux, Zustand), server caches, SQLite/OPFS, Dexie Cloud and Drive/Dropbox APIs (break the no-account rule), `eval`/mathjs for expressions (write a tiny parser), list virtualisation for a few thousand rows (chunked infinite scroll is enough).

## 4. Repository and GitHub Pages

- Vite **`base` must equal `'/<repo-name>/'`**. Renaming the repo means changing `base`, or the manifest 404s and the app won't install.
- Deploy with GitHub Actions (`starter/.github/workflows/deploy.yml`) on every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. Commit `package-lock.json` (the workflow uses `npm ci`).
- `.gitignore` must exclude personal data: `legacy-data/*`, `*-backup-*.json`, `*.json.txt`, `*.csv` (see `starter/.gitignore`).
- `index.html`: `viewport-fit=cover`, `theme-color` = background colour, `color-scheme: dark`, SVG favicon + 32 px PNG + apple-touch icon.
- Manifest: `start_url: './'`, `scope: './'`, `display: standalone`, `orientation: portrait`, `theme_color` and `background_color` = the bg token, icons **192 + 512 as `any` and as `maskable`** (separate files; maskable art keeps a safe zone), and optional **`shortcuts`** for the main action (long-press on the home-screen icon), with their own 96/192 icons.
- **Android WebAPK caveat:** the installed app keeps the icon, name and system-bar colour from install time. After changing any of them, the user must **back up, uninstall and reinstall**. A green Android nav bar after a colour change was exactly this.

## 5. Data model rules

- **Primary keys are strings.** New rows get `crypto.randomUUID()`; imported legacy ids are kept as strings.
- **Money is integer cents.** Round once, at the end of a calculation, half away from zero. Format with a custom formatter, not `Intl` with `es-ES` (it drops the thousands separator for 4-digit numbers): `€1.492,76`, `-€424,04`.
- **Calendar dates are `YYYY-MM-DD` strings**, never timestamps (no timezone drift). Timestamps (`createdAt`, `updatedAt`) are ISO strings.
- **Derived values are computed, not stored** (e.g. how often a category is used), so they can't drift.
- **Lookup lists** (types, groups, colours, tags…): rename and **hide/unhide**; delete only while unused, with **Undo**. Hidden items vanish from pickers but still resolve on old rows. Names are unique ignoring case and accents.
- A `meta` key/value table holds `schemaVersion`, settings and device state (`lastBackupAt`). `ensureDefaults()` fills missing settings on start and never overwrites.
- **Schema changes** = a new Dexie `version(n)` with an upgrade, *and* a backup migration step from the previous file version. Bump `SCHEMA_VERSION` in one place.
- Recurring entries are **real rows** sharing a `seriesId`. Edits/deletes ask "this one / this and later ones"; later rows keep their own dates.
- Put every calculation in `domain/` as a pure function with tests. Screens only render.

## 6. PWA behaviour

- **Service worker precaches the app shell only** and never touches IndexedDB.
- **Updates are never applied silently** (data entry must not be interrupted): `registerType: 'prompt'` and a centred **Update available** dialog with **Ignore** and **Reload** (`starter/src/app/UpdateBanner.tsx`). A small banner was too easy to miss.
- On start, call `navigator.storage.persist()`. Show the `persisted()` result in Setup with a "Request persistent storage" button. It is not a guarantee, so backups are part of the product.
- Show `APP_VERSION` in Setup and bump it every release, so the user can confirm the phone runs the new build.

## 7. Design system and UI rules

The visual system is in `design-system.md` (tokens, type, components) and implemented in `starter/src/styles/global.css` plus the starter components. **New apps must look like siblings of Xpence**: same tokens, fonts, radii, components, night-ridges background, bottom navigation. A new app may pick a different **accent hue** only if the user asks; everything else stays.

Layout and interaction rules learned the hard way:

- **Nothing may shift the layout.** Hint/error lines above buttons have a fixed height. (A "Enter an amount" hint made the keypad jump.)
- **Bottom sheets render into `<body>` via a portal**, otherwise the bottom nav's stacking context hides them.
- **Snackbar** for confirmations, with **Undo** for destructive actions (6 s, one at a time, survives navigation). Each screen sets its offset with `useSnackbarPlacement` so it never covers the bottom button, the nav or a total bar.
- **Long press** has a move tolerance (doesn't fire while scrolling), a short vibration, and swallows the following click (`useLongPress`).
- Touch targets ≥ 48 px. Primary actions in the lower half (thumb reach). Respect `env(safe-area-inset-*)`. Use `100dvh`.
- **Never use colour alone** for meaning: pair with a word, sign or icon. Colour meaning: accent blue = action/selection, green = money in / better, amber = warning / trending over, red = error / delete / over.
- **Numbers** in Space Grotesk with tabular figures. Dates in running text use non-breaking hyphens (`‑`) so `05-01-2027` never wraps.
- **Avoid generic CSS Module class names** that may also exist elsewhere (`.empty`, `.row`): give them specific names. A clash once made table cells too tall.
- **Use links between screens with filters in the URL** (`/#/items?month=2026-10&type=4`): the target reads them once, then clears the query. It makes "where did this number come from?" one tap.
- For a custom number keypad: phone order (`1 2 3` on top), operators in a column, hold backspace to clear, never open the Android keyboard for amounts.
- `<input type="date">` works fine on Android; use it rather than a custom picker.

## 8. Code organisation and TypeScript traps

```text
src/
  main.tsx        fonts, global.css, ensureDefaults, storage.persist, render
  app/            App.tsx (routes), TabLayout (background + bottom nav), UpdateBanner, version.ts
  db/             Dexie schema, db instance, meta/defaults, hooks (settings, usage)
  domain/         pure logic + tests (no React, no Dexie)
  backup/         Zod schema, build, restore, CSV, share/download + tests (no React)
  features/<x>/   one folder per screen: Page.tsx, rows, sheets, Page.module.css
  components/     icons, BottomSheet, Snackbar, shared inputs
  styles/         global.css (tokens, reset)
tools/            one-off Node scripts (e.g. legacy migration), never shipped
```

- **Narrowing doesn't reach inner functions.** After `if (x === undefined) return …`, functions declared below still see `x` as possibly `undefined`. Copy it into a typed `const` after the guard and use that inside handlers.
- All hooks run before any early `return` (loading guards come after the last hook).
- `useLiveQuery` returns `undefined` while loading: render nothing or a skeleton, not an empty state.
- Prefer one big `toArray()` and in-memory filtering for a few thousand rows; it is fast and simpler than index gymnastics.
- Dependencies: `npm audit --omit=dev` must be clean. Dev-only findings (Vite's esbuild dev server) don't reach the built app; explain rather than force-upgrade.

## 9. Backup and restore (the core safety feature)

Use `starter/src/backup/` and keep this exact behaviour:

**Export (JSON)**
- One file containing every table, plus `app`, `schemaVersion`, `exportedAt` and settings. Rows sorted for stable diffs. `lastBackupAt` is device state and is *not* in the file.
- Share with `navigator.share({ files })` so the user can pick Dropbox, pCloud, etc. **Chrome on Android refuses `.json` files**, so share as **`<app>-backup-YYYY-MM-DD.json.txt` with `text/plain`** (content is plain JSON). Fallback when sharing isn't available: download as `.json`.
- Set `lastBackupAt` **only** when sharing or downloading completed, **not** when the share sheet was cancelled (`AbortError`).
- Home and Setup show the backup status with the **same function** (today / N days ago / overdue after the reminder setting / never), so the two screens never disagree.

**Restore**
- File picker with **`accept=".json,.txt"`** (the Android picker reaches the cloud drives).
- Parse, then validate with Zod, including **referential integrity** (every referenced id exists) and duplicate ids. Reject unknown `schemaVersion` with a clear message.
- Show errors in plain words, at most a few, e.g. `Item row 2: amount should be a number`, `Not a <App> backup: missing "items" table`, and "Nothing was changed on this phone."
- Show what the file contains (counts, export date) and what will be overwritten; ask to confirm with a red "Replace all data".
- **Download a recovery copy of the current data first**, then replace **all tables in one Dexie transaction** (all or nothing).

**CSV export** (optional, for Excel): one file per table, UTF-8 **with BOM**, `;` separator, decimal-comma amounts, ISO dates, `true/false`, quoted where needed; add human-readable name columns next to foreign-key ids. Export only, never import.

**Legacy data**: migrate with a one-off Node script in `tools/` that reads the old export (check the encoding, e.g. Windows-1252), applies documented decisions for every anomaly, validates with **the app's own Zod schema**, prints a report and writes a normal backup file. The user restores it with the normal restore. The app contains no import code.

## 10. Testing and verification

- Unit tests for every `domain/` and `backup/` module, including a backup round trip, malformed files and edge dates (month ends, leap years).
- Render each implemented screen at 390 × 844 and compare with the design canvas before handing over.
- The user runs `npm run typecheck && npm test && npm run build` locally, then pushes.

## 11. Phone checklist (give the user the relevant items)

- Install from Chrome; open in **airplane mode**; long-press the icon for the shortcut.
- Icon, name and system-bar colour correct (reinstall if they changed).
- Setup shows persistent storage granted and the new version number.
- Export backup opens the **share sheet** and the file arrives in Dropbox/pCloud; restore from that file (`.json.txt`) and from a `.json`.
- Date pickers, long-press, keypad and bottom sheets behave; nothing hides behind the nav bar.
- After a deploy, the **Update available** dialog appears; Reload works; Ignore hides it.

## 12. Definition of done for a release

- Typecheck, tests and build pass on the user's machine; `npm audit --omit=dev` clean.
- Phone checklist passed for anything device-related.
- Docs describe what is built; design briefs marked implemented.
- `APP_VERSION` bumped; zip delivered with the list of files to delete.
