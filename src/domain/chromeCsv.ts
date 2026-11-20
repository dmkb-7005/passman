import { hostOf, LIMITS } from './logins';

/*
 * Chrome's "Export passwords" CSV (docs/DATA-MODEL.md §7). Parsed in memory only; nothing is stored.
 */

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvError';
  }
}

/** RFC 4180: commas, quotes ("" inside quotes), line breaks inside quotes; LF, CRLF or CR; optional BOM. */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      fieldStarted = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      fieldStarted = false;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (quoted) throw new CsvError('The file ends inside a quoted field');
  if (fieldStarted || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ImportRow {
  /** 1-based position among the data rows (the header is not counted) */
  row: number;
  name: string;
  url: string;
  username: string;
  password: string;
}

export interface SkippedRow {
  row: number;
  name: string;
  reason: string;
}

export type ChromeImport =
  | { ok: true; rows: ImportRow[]; skipped: SkippedRow[]; notesIgnored: number }
  | { ok: false; error: string };

const NOT_CHROME = "This doesn't look like a Chrome passwords export";

/** Columns are found by header name, not by position. */
export function readChromeCsv(text: string): ChromeImport {
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch (err) {
    return { ok: false, error: err instanceof CsvError ? `${NOT_CHROME}: ${err.message.toLowerCase()}` : NOT_CHROME };
  }
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iName = col('name');
  const iUrl = col('url');
  const iUser = col('username');
  const iPass = col('password');
  const iNote = col('note');
  if (iUrl < 0 || iPass < 0) return { ok: false, error: NOT_CHROME };

  const rows: ImportRow[] = [];
  const skipped: SkippedRow[] = [];
  let notesIgnored = 0;
  table.slice(1).forEach((cells, index) => {
    if (cells.every((c) => c.trim() === '')) return;
    const get = (i: number) => (i >= 0 ? (cells[i] ?? '') : '');
    const row = index + 1;
    const url = get(iUrl).trim();
    const username = get(iUser).trim();
    const password = get(iPass);
    const name = get(iName).trim() || hostOf(url) || 'Untitled';
    if (get(iNote).trim()) notesIgnored++;
    if (!password) {
      skipped.push({ row, name, reason: 'No password' });
      return;
    }
    if (name.length > LIMITS.name || url.length > LIMITS.url || username.length > LIMITS.username || password.length > LIMITS.password) {
      skipped.push({ row, name: name.slice(0, LIMITS.name), reason: 'A field is too long' });
      return;
    }
    rows.push({ row, name, url, username, password });
  });
  return { ok: true, rows, skipped, notesIgnored };
}
