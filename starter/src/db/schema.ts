import Dexie, { type EntityTable } from 'dexie';

/*
 * EXAMPLE schema: replace `categories` / `items` with the app's tables (see docs/DATA-MODEL.md).
 * Rules: string ids (crypto.randomUUID()), integer cents, `YYYY-MM-DD` calendar dates,
 * ISO timestamps, derived values computed rather than stored.
 */

export interface Category {
  id: string;
  name: string;
  /** hidden items vanish from pickers but still resolve on old rows */
  hidden: boolean;
  createdAt: string;
}

export interface Item {
  id: string;
  /** YYYY-MM-DD calendar date, never a timestamp */
  date: string;
  /** integer cents; may be negative or zero */
  amountCents: number;
  categoryId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  items!: EntityTable<Item, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'myapp') {
    super(name);
    this.version(1).stores({
      categories: 'id, name',
      items: 'id, date, categoryId',
      meta: 'key',
    });
  }
}

/** The tables that a backup contains and a restore replaces (not `meta`). Keep in sync with backup/schema.ts. */
export const DATA_TABLES = ['categories', 'items'] as const;
export type DataTable = (typeof DATA_TABLES)[number];
