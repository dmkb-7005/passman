import { z } from 'zod';
import { SCHEMA_VERSION } from '../db/version';
import { APP_ID } from './app';

/*
 * Backup file format. Replace the EXAMPLE table schemas with the app's tables; keep the envelope,
 * the integrity checks and the readable error messages.
 */

const id = z.string().min(1);
const text = z.string().min(1);
const isoDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'is not a valid date (YYYY-MM-DD)');
const cents = z.number().int('must be whole cents');

// ---- EXAMPLE tables ----
const categorySchema = z.object({ id, name: text, hidden: z.boolean(), createdAt: text });
const itemSchema = z.object({
  id, date: isoDate, amountCents: cents, categoryId: id, note: z.string(), createdAt: text, updatedAt: text,
});
const settingsSchema = z.object({ backupReminderDays: z.number().int().min(1).max(365) });

export const backupSchema = z
  .object({
    app: z.literal(APP_ID),
    schemaVersion: z.literal(SCHEMA_VERSION),
    exportedAt: text,
    settings: settingsSchema,
    categories: z.array(categorySchema),
    items: z.array(itemSchema),
  })
  .superRefine((b, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });
    const idsOf = (name: string, rows: readonly { id: string }[]) => {
      const seen = new Set<string>();
      rows.forEach((row, i) => {
        if (seen.has(row.id)) issue(`${row.id} appears twice`, [name, i, 'id']);
        seen.add(row.id);
      });
      return seen;
    };
    // duplicate ids and referential integrity: every reference must exist in the same file
    const categories = idsOf('categories', b.categories);
    idsOf('items', b.items);
    b.items.forEach((item, i) => {
      if (!categories.has(item.categoryId)) issue(`id ${item.categoryId} does not exist`, ['items', i, 'categoryId']);
    });
  });

export type Backup = z.infer<typeof backupSchema>;

/** Labels for readable restore errors: `Item row 2: amount should be a number`. */
const TABLE_LABEL: Record<string, string> = { categories: 'Category', items: 'Item', settings: 'Settings' };
const FIELD_LABEL: Record<string, string> = {
  amountCents: 'amount', categoryId: 'category', date: 'date', id: 'id', name: 'name', note: 'note',
};

// ---- generic below this line ----

export type ParseBackupResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

/** Validates parsed JSON. Unknown schema versions get a clear message instead of a list of field errors. */
export function parseBackup(raw: unknown): ParseBackupResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: [`The file is not a ${APP_ID} backup.`] };
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if ((raw as { app?: unknown }).app === APP_ID && version !== SCHEMA_VERSION) {
    return { ok: false, errors: [`Unsupported schemaVersion ${String(version)} (this app reads ${SCHEMA_VERSION}).`] };
  }
  const result = backupSchema.safeParse(raw);
  if (result.success) return { ok: true, backup: result.data };
  return { ok: false, errors: result.error.issues.slice(0, 20).map((i) => describeIssue(i, raw)) };
}

type Issue = z.ZodError['issues'][number];

/** The value at a path in the original input; undefined when absent (Zod 4 no longer reports `received`). */
function valueAt(raw: unknown, path: readonly PropertyKey[]): unknown {
  let v: unknown = raw;
  for (const key of path) {
    if (typeof v !== 'object' || v === null) return undefined;
    v = (v as Record<PropertyKey, unknown>)[key];
  }
  return v;
}

export function describeIssue(issue: Issue, raw: unknown): string {
  const path = issue.path as readonly PropertyKey[];
  const [table, index, field] = path;
  const missing = valueAt(raw, path) === undefined;
  if (path.length === 1 && typeof table === 'string' && issue.code === 'invalid_type' && missing) {
    return `Not a ${APP_ID} backup: missing "${table}" table`;
  }
  if (typeof table === 'string' && typeof index === 'number') {
    const where = `${TABLE_LABEL[table] ?? table} row ${(index + 1).toLocaleString('de-DE')}`;
    const what = typeof field === 'string' ? FIELD_LABEL[field] ?? field : null;
    if (issue.code === 'invalid_type') {
      const expected = 'expected' in issue ? String(issue.expected) : 'different value';
      return what ? `${where}: ${what} ${missing ? 'is missing' : `should be a ${expected}`}` : `${where}: invalid entry`;
    }
    return what ? `${where}: ${what} ${issue.message}` : `${where}: ${issue.message}`;
  }
  return `${path.map(String).join('.') || 'File'}: ${issue.message}`;
}
