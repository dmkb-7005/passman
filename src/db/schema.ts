import Dexie, { type EntityTable } from 'dexie';

/*
 * PassMan stores no readable secrets in IndexedDB (docs/ARCHITECTURE.md §2.2):
 * - `vault`: one row holding the encrypted vault file (docs/DATA-MODEL.md §1)
 * - `meta`:  device metadata and settings (docs/DATA-MODEL.md §4)
 */

export interface VaultRow {
  key: 'current';
  /** the encrypted vault file; its shape is defined and validated in src/crypto/vaultFile.ts */
  file: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  vault!: EntityTable<VaultRow, 'key'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'passman') {
    super(name);
    this.version(1).stores({
      vault: 'key',
      meta: 'key',
    });
  }
}
