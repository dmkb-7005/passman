# <App name>

<One sentence: what the app does, for whom.> Local-first PWA for one user on one Android phone.

## Read first

1. `docs/PLAYBOOK.md`: how all my local-first PWAs are built (stack, GitHub Pages, backup/restore, update dialog, process, TypeScript traps). Follow it unless this file or `docs/SCOPE.md` says otherwise.
2. `docs/design-system.md`: the shared dark design system. Every screen must look like the same family of apps.
3. `docs/SCOPE.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`: this app's plan (write them first if they don't exist yet, from `docs/templates/`, and ask me to approve them).

## Project facts

- Repo: `<owner>/<repo>`, served at `https://<owner>.github.io/<repo>/` → Vite `base: '/<repo>/'`.
- Main action (app shortcut + FAB): `<e.g. Add entry>` → `./#/<route>/new`.
- Backup file name: `<app>-backup-YYYY-MM-DD.json(.txt)`. Cloud drives used: Dropbox, pCloud.
- Language of UI copy: English. Data names: <as entered / imported>.
- Legacy data to migrate: <none | describe source and format>.

## Deviations from the playbook

- <none yet>

## How to hand over work

- Zip of changed files (unzips over the repo root) + a list of files to delete.
- I run `npm run typecheck && npm test && npm run build` before pushing, and test on the phone with the checklist you give me.
