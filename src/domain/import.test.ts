import { parseCsv, readChromeCsv, type ImportRow } from './chromeCsv';
import { applyImport, defaultDecision, importCount, planImport, type Decision } from './importPlan';
import { isLogin, type Entry, type Login } from './logins';

describe('parseCsv', () => {
  it('handles BOM, CRLF, quotes, escaped quotes, commas and line breaks inside quotes', () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n,,\n"last"';
    expect(parseCsv(text)).toEqual([['a', 'b', 'c'], ['x, y', 'say "hi"', 'line1\nline2'], ['', '', ''], ['last']]);
  });
  it('ignores a final line break and accepts CR line ends', () => {
    expect(parseCsv('a,b\rc,d\r')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"b')).toThrow();
  });
});

describe('readChromeCsv', () => {
  const CSV = [
    'name,url,username,password,note',
    'amazon.de,https://www.amazon.de/,me@example.com,"pa,ss""word",',
    ',https://bank.example/login,customer1,b@nk!,remember PIN',
    'com.example.app,android://hash@com.example.app/,app-user,app-pass,',
    'nopass.example,https://nopass.example/,someone,,',
    '',
  ].join('\n');

  it('maps rows by header name, derives missing names, drops notes and skips rows without a password', () => {
    const r = readChromeCsv(CSV);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([
      { row: 1, name: 'amazon.de', url: 'https://www.amazon.de/', username: 'me@example.com', password: 'pa,ss"word' },
      { row: 2, name: 'bank.example', url: 'https://bank.example/login', username: 'customer1', password: 'b@nk!' },
      { row: 3, name: 'com.example.app', url: 'android://hash@com.example.app/', username: 'app-user', password: 'app-pass' },
    ]);
    expect(r.skipped).toEqual([{ row: 4, name: 'nopass.example', reason: 'No password' }]);
    expect(r.notesIgnored).toBe(1);
  });

  it('works with older exports without a note column and in another column order', () => {
    const r = readChromeCsv('password,username,url,name\nsecret,me,https://a.example,A');
    expect(r).toMatchObject({ ok: true, rows: [{ name: 'A', url: 'https://a.example', username: 'me', password: 'secret' }], notesIgnored: 0 });
  });

  it('rejects files that are not Chrome exports', () => {
    expect(readChromeCsv('date,amount\n2026-01-01,5')).toEqual({ ok: false, error: "This doesn't look like a Chrome passwords export" });
    expect(readChromeCsv('')).toMatchObject({ ok: false });
    expect(readChromeCsv('url,password\n"broken')).toMatchObject({ ok: false });
  });

  it('skips rows with a field over the limit', () => {
    const r = readChromeCsv(`url,password\nhttps://a.example,${'p'.repeat(1001)}`);
    expect(r).toMatchObject({ ok: true, rows: [], skipped: [{ reason: 'A field is too long' }] });
  });
});

describe('import plan', () => {
  const now = new Date('2026-11-21T08:00:00.000Z');
  const existing: Login = {
    id: 'v1', name: 'Amazon', url: 'https://www.amazon.de', username: 'Me@Example.com', password: 'old',
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
  };
  const row = (n: number, over: Partial<ImportRow> = {}): ImportRow => ({ row: n, name: 'amazon.de', url: 'https://amazon.de/ap', username: 'me@example.com', password: 'new', ...over });
  let counter = 0;
  const newId = () => `new-${++counter}`;
  beforeEach(() => { counter = 0; });

  it('finds duplicates against the vault (same host, same username ignoring case) and within the file', () => {
    const rows = [row(1), row(2, { url: '', name: 'GitHub', username: 'dev', password: 'g1' }), row(3, { url: '', name: 'github ', username: 'DEV', password: 'g1' }), row(4, { username: 'other' })];
    const plan = planImport([existing], rows);
    expect(plan.fresh.map((r) => r.row)).toEqual([2, 4]);
    expect(plan.duplicates.map((d) => [d.row.row, d.target.kind, d.identical])).toEqual([[1, 'vault', false], [3, 'file', true]]);
    expect(plan.duplicates.map(defaultDecision)).toEqual([null, 'keep-existing']);
  });

  it('ignores deleted logins when looking for duplicates', () => {
    const plan = planImport([{ id: 'v1', deleted: true, updatedAt: now.toISOString() }], [row(1)]);
    expect(plan.duplicates).toHaveLength(0);
  });

  it('applies keep existing, use imported and keep both', () => {
    const rows = [row(1), row(2, { username: 'x', url: '', name: 'Bank' }), row(3, { username: 'x', url: '', name: 'bank', password: 'newer' }), row(4, { password: 'third' })];
    const plan = planImport([existing], rows);
    const decisions = new Map<number, Decision>([[1, 'use-imported'], [3, 'use-imported'], [4, 'keep-both']]);
    const result = applyImport([existing], plan, decisions, now, newId);
    expect(result).toMatchObject({ added: 2, replaced: 2, skipped: 0 });
    const logins = result.entries.filter(isLogin);
    expect(logins.find((l) => l.id === 'v1')).toMatchObject({ password: 'new', createdAt: existing.createdAt, updatedAt: now.toISOString() });
    expect(logins.find((l) => l.id === 'new-1')).toMatchObject({ name: 'bank', password: 'newer' });
    expect(logins.find((l) => l.id === 'new-2')).toMatchObject({ password: 'third' });
  });

  it('counts the logins an import writes, as the Import button and the done screen show them', () => {
    const rows = [row(1), row(2, { username: 'x', url: '', name: 'Bank' }), row(3, { username: 'x', url: '', name: 'bank', password: 'newer' }), row(4, { password: 'third' }), row(5, { name: 'Zoo', url: 'https://zoo.example', username: 'z' })];
    const plan = planImport([existing], rows);
    const decisions = new Map<number, Decision>([[1, 'use-imported'], [3, 'keep-existing'], [4, 'keep-both']]);
    expect(importCount(plan, decisions)).toBe(4);
    const result = applyImport([existing], plan, decisions, now, newId);
    expect(result.added + result.replaced).toBe(4);
    expect(result.skipped).toBe(1);
    expect(importCount(plan, new Map())).toBe(plan.fresh.length);
  });

  it('keep existing leaves the vault untouched', () => {
    const plan = planImport([existing], [row(1)]);
    const result = applyImport([existing], plan, new Map([[1, 'keep-existing']]), now, newId);
    expect(result).toMatchObject({ added: 0, replaced: 0, skipped: 1, entries: [existing] });
  });

  it('refuses to apply with undecided duplicates', () => {
    const plan = planImport([existing], [row(1)]);
    expect(() => applyImport([existing], plan, new Map(), now, newId)).toThrow(/No decision/);
  });

  it('end to end: Chrome CSV into an empty vault', () => {
    const csv = readChromeCsv('name,url,username,password\nA,https://a.example,u,p1\nA,https://a.example,u,p1\nB,,v,p2');
    if (!csv.ok) throw new Error(csv.error);
    const plan = planImport([], csv.rows);
    const decisions = new Map(plan.duplicates.map((d) => [d.row.row, defaultDecision(d) ?? 'keep-both'] as const));
    const result = applyImport([] as Entry[], plan, decisions, now, newId);
    expect(result).toMatchObject({ added: 2, skipped: 1 });
  });
});
