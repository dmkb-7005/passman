# <App>: Data model

## Database

Dexie database `<name>`, `version(1)` (`SCHEMA_VERSION = 1`). Primary keys are **strings** (`crypto.randomUUID()`; imported legacy ids kept as strings).

| Table | Fields | Indexes |
|---|---|---|
| `<items>` | `id`, `date` (`YYYY-MM-DD`), `amountCents`, `<categoryId>`, `note`, `createdAt`, `updatedAt` | `id`, `date`, `<categoryId>` |
| `<categories>` | `id`, `name`, `hidden`, `createdAt` | `id`, `name` |
| `meta` | `key`, `value` | `key` |

`meta` keys: `schemaVersion`, `lastBackupAt` (device state, not in backups), `backupReminderDays` (default 14), <other settings with defaults>.

Rules:
- <Value rules: integers, ranges, allowed negatives/zero, required vs nullable references.>
- Usage of a lookup item is computed live (number of rows referencing it), never stored.
- An item in use can't be deleted, only hidden. Hidden items stay resolvable on old rows.

## Calculations (pure functions in `domain/`)

<Every figure shown on a screen: definition, which rows count, edge cases (empty data, partial month, future-dated rows), rounding, display format. Write formulas, not prose.>

## Backup JSON (schema version 1)

```json
{
  "app": "<app>",
  "schemaVersion": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "settings": { "backupReminderDays": 14 },
  "<categories>": [{ "id": "…", "name": "…", "hidden": false, "createdAt": "…" }],
  "<items>": [{ "id": "…", "date": "2026-01-01", "amountCents": 1299, "<categoryId>": "…", "note": "", "createdAt": "…", "updatedAt": "…" }]
}
```

- Shared as `<app>-backup-YYYY-MM-DD.json.txt` (download fallback `.json`).
- Restore validates with Zod (types, referential integrity, duplicate ids), rejects unknown `schemaVersion`, reports problems in plain words, replaces every table in one transaction.
- Future schema changes: Dexie `version(n)` upgrade + backup migration from the previous version.

## CSV export

<Tables, columns, UTF-8 with BOM, `;`, decimal comma | none>

## Legacy import mapping

<None | table of legacy field → new field, encoding, and a list of decisions for each known data issue.>
