# <App>: Architecture

Follows `docs/PLAYBOOK.md`. This file records only this app's specifics and any deviations.

## Stack

As in the playbook (Vite, React 19, TypeScript strict, HashRouter, Dexie + `useLiveQuery`, Zod 4, Vitest, `vite-plugin-pwa` with prompt updates, CSS Modules, bundled Inter + Space Grotesk). Additions: <none | library and why>.

## Hosting

- Repo `<owner>/<repo>`, https://<owner>.github.io/<repo>/, Vite `base: '/<repo>/'`.
- Deploy: `.github/workflows/deploy.yml` on push to `main`; Pages source = GitHub Actions.
- Manifest: name `<App>`, theme/background `#1a1f2b`, icons any + maskable 192/512, shortcut `<label>` → `./#/<route>`.

## Storage and backup

- Dexie database `<name>`, schema in DATA-MODEL.md.
- Backup: share as `<app>-backup-YYYY-MM-DD.json.txt` (`text/plain`), download fallback `.json`; restore accepts `.json,.txt`; recovery copy before replacing; one transaction.
- CSV export: <tables | none>.

## Folder layout

As in the playbook. Feature folders: `features/<home|…|setup>`.

## Legacy migration

<None | `tools/migrate-legacy/`: source files, encoding, output backup file, documented decisions in DATA-MODEL.md.>

## Build phases

1. Scaffold + deploy + install check on the phone.
2. `domain/` and `backup/` with tests.
3. <Legacy migration and first restore.>
4. Design briefs → Claude Design.
5. <Screens, one per phase, in priority order.>
6. Setup and backup UI; icons; phone checklist.
7. Cleanup, docs, version bump.

## Risks

- Data loss on site-data clear or uninstall: backup reminders, persistent storage, export before reinstalling.
- <App-specific risks.>
