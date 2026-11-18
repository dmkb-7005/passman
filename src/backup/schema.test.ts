import { describe, expect, it } from 'vitest';
import { APP_ID } from './app';
import { parseBackup } from './schema';

const valid = () => ({
  app: APP_ID,
  schemaVersion: 1,
  exportedAt: '2026-11-18T10:00:00.000Z',
  settings: { backupReminderDays: 14 },
  categories: [{ id: 'c1', name: 'Food', hidden: false, createdAt: '2026-01-01T00:00:00.000Z' }],
  items: [{ id: 'i1', date: '2026-11-17', amountCents: 1299, categoryId: 'c1', note: '', createdAt: 'x', updatedAt: 'x' }],
});

describe('parseBackup', () => {
  it('accepts a valid file', () => {
    expect(parseBackup(valid()).ok).toBe(true);
  });
  it('explains problems in plain words', () => {
    const b = valid() as Record<string, unknown>;
    (b.items as Record<string, unknown>[])[0]!.amountCents = '12,99';
    const r = parseBackup(b);
    expect(r).toEqual({ ok: false, errors: ['Item row 1: amount should be a number'] });
  });
  it('reports a missing table and a wrong file', () => {
    const b = valid() as Record<string, unknown>;
    delete b.items;
    expect(parseBackup(b)).toEqual({ ok: false, errors: [`Not a ${APP_ID} backup: missing "items" table`] });
    expect(parseBackup('hello').ok).toBe(false);
  });
  it('checks references and duplicates', () => {
    const b = valid();
    b.items.push({ ...b.items[0]!, categoryId: 'nope' });
    const r = parseBackup(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(['Item row 2: id i1 appears twice', 'Item row 2: category id nope does not exist']);
  });
  it('rejects other schema versions with one clear message', () => {
    expect(parseBackup({ ...valid(), schemaVersion: 2 })).toEqual({ ok: false, errors: ['Unsupported schemaVersion 2 (this app reads 1).'] });
  });
});
