# PassMan: data model

Status: **approved** (2026-11-20)

## 1. Vault file (Dropbox, IndexedDB and backups use the same file)

UTF-8 JSON. Binary values are base64url strings.

```jsonc
{
  "format": "passman-vault",
  "version": 1,                       // file format version
  "vaultId": "uuid",                  // new only when a vault is created or replaced by a restore
  "keyset": {
    "id": "uuid",                     // changes when the password or recovery key changes
    "updatedAt": "2026-11-20T10:00:00.000Z",
    "password": {
      "kdf": { "alg": "argon2id", "memoryKiB": 65536, "iterations": 3, "parallelism": 1, "salt": "…16 bytes" },
      "iv": "…12 bytes", "wrappedKey": "…DEK encrypted with KEK-P"
    },
    "recovery": {
      "kdf": { "alg": "hkdf-sha256", "salt": "…16 bytes", "info": "passman/recovery/v1" },
      "iv": "…12 bytes", "wrappedKey": "…DEK encrypted with KEK-R"
    }
  },
  "payload": {
    "iv": "…12 bytes",
    "ciphertext": "…AES-256-GCM(JSON payload), AAD = format|version|vaultId"
  }
}
```

The header is validated with Zod before any decryption. Unknown `format` or a newer `version` gives a clear message ("This vault was made by a newer PassMan. Update the app.") and changes nothing.

## 2. Payload (decrypted)

```jsonc
{
  "schemaVersion": 1,
  "logins": [ Login | Tombstone ]
}
```

### Login

| Field | Type | Rules |
|---|---|---|
| `id` | string | `crypto.randomUUID()` |
| `name` | string | Required, trimmed, 1–100 characters |
| `url` | string | Optional (empty string if none), trimmed, max 2 000; stored as entered (no `https://` added automatically, but links open with `https://` if no scheme) |
| `username` | string | Optional (empty string if none), trimmed, max 200. UI label "Username or email" |
| `password` | string | Required, 1–1 000 characters, **not** trimmed |
| `createdAt` | ISO timestamp | |
| `updatedAt` | ISO timestamp | Set on every change; used by the merge |

### Tombstone (deleted login)

| Field | Type |
|---|---|
| `id` | string |
| `deleted` | `true` |
| `updatedAt` | ISO timestamp of the deletion |

A change always gets an `updatedAt` later than the version it replaces, even if the device clock is behind. Tombstones are kept indefinitely (about 80 bytes each) so that an offline device can't bring a deleted login back. **Undo** within 6 s turns a tombstone back into the login with a new `updatedAt`.

### Derived (computed, never stored)
- `siteKey`: from `url` → host in lower case without `www.` (for `android://…@com.example.app/` → the package name `com.example.app`); without a URL → `name` in lower case, accents removed, spaces collapsed.
- `usernameKey`: `username` trimmed, lower case.
- Duplicate = same `siteKey` and same `usernameKey`. Identical = duplicate with the same password. Imported rows are compared with the vault first (deleted logins ignored), then with earlier rows of the same file.
- Passwords are NFC-normalised before key derivation, so the same password typed on Android and Windows gives the same key.
- Sort and search: `name` ignoring case and accents; search also matches `url` and `username`.

## 3. Merge rules (`domain/merge.ts`)

Per `id`, between local and remote:

| Local | Remote | Result |
|---|---|---|
| present | missing | local |
| missing | present | remote |
| login / tombstone | login / tombstone | the one with the later `updatedAt` |
| equal `updatedAt`, different content | | deterministic: the one whose JSON sorts first, so all devices pick the same |

Timestamps come from the device clocks. A clock several minutes wrong only matters if the same login is edited on two devices within those minutes; that's accepted.

## 4. IndexedDB (Dexie)

```ts
db.version(1).stores({
  vault: 'key',   // single row: { key: 'current', file: VaultFile }
  meta:  'key',   // key/value rows, below
});
```

| `meta` key | Value | Notes |
|---|---|---|
| `schemaVersion` | `1` | |
| `deviceId` | uuid | Created on first start |
| `settings` | see §5 | Per device, not synced |
| `sync` | `{ accountId, email, refreshToken: { iv, ciphertext }, lastSyncedRev, syncedVersion, lastSyncedAt }` | Absent when not connected. Refresh token encrypted with the DEK (`encryptSecret`, purpose `dropbox-refresh-token`). `syncedVersion` = `keysetId:payloadIv` of the local file at the last sync; any other value means local changes to upload. Sync problems are not stored (found again on the next sync) |
| `lastBackupAt` | ISO timestamp | Device state, as in the playbook |

## 5. Settings (per device)

| Setting | Default | Options |
|---|---|---|
| `lockIdleMinutes` | 5 | 1, 2, 5, 10, 30 |
| `lockBackgroundSeconds` | 60 | 0, 30, 60, 300 |
| `clipboardClearSeconds` | 30 | fixed in v1 |
| `backupReminderDays` | 30 | 7, 14, 30, 90, never |
| `generator` | `{ length: 20, lower: true, upper: true, digits: true, symbols: true, avoidLookAlikes: true }` | length 8–64 |

Symbols set: `!#$%&*+-=?@^_~` (no quotes, backslash or spaces, which some sites reject). Look-alikes removed: `0 O o 1 l I`.

## 6. Recovery key

160 random bits → 32 characters of Crockford Base32 (`0-9 A-Z` without `I L O U`), shown as 8 groups of 4: `7K3M-Q9TD-…`. Parsing: upper-case, remove spaces and dashes, map `O→0`, `I/L→1`; anything else invalid → "That isn't a valid recovery key". A well-formed key for another vault gives "This recovery key doesn't open this vault".

## 7. Chrome CSV mapping

| Chrome column | PassMan |
|---|---|
| `name` | `name` (if empty: host of `url`, else "Untitled") |
| `url` | `url` |
| `username` | `username` |
| `password` | `password` (row skipped if empty) |
| `note` | dropped (count shown in the summary) |

Columns are found by header name, not position. A file without `url` and `password` columns is rejected: "This doesn't look like a Chrome passwords export".

## 8. Versioning
- File `version` changes only when the vault file structure changes; payload `schemaVersion` when login fields change. Each change ships with a migration step and tests, as in the playbook.
- Argon2 parameters can be raised later without a format change: they're stored per keyset and applied on the next password change.
