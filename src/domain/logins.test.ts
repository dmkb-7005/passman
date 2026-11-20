import {
  createLogin,
  deleteLogin,
  fold,
  hostOf,
  nextTimestamp,
  PayloadSchema,
  restoreLogin,
  searchLogins,
  siteKey,
  sortLogins,
  updateLogin,
  upsertEntry,
  urlForOpening,
  validateLoginInput,
  type Login,
} from './logins';
import { masterPasswordProblem } from './masterPassword';

const t0 = new Date('2026-11-20T10:00:00.000Z');
const login = (over: Partial<Login> = {}): Login => ({
  id: 'id-1', name: 'Amazon', url: 'https://www.amazon.de/login', username: 'Me@Example.com', password: 'secret',
  createdAt: t0.toISOString(), updatedAt: t0.toISOString(), ...over,
});

describe('validateLoginInput', () => {
  it('trims name, URL and username but never the password', () => {
    const r = validateLoginInput({ name: '  Bank ', url: ' bank.de ', username: ' me ', password: ' pw ' });
    expect(r).toEqual({ ok: true, value: { name: 'Bank', url: 'bank.de', username: 'me', password: ' pw ' } });
  });
  it('requires a name and a password; URL and username are optional', () => {
    expect(validateLoginInput({ name: ' ', url: '', username: '', password: '' })).toEqual({ ok: false, errors: { name: 'Enter a name', password: 'Enter a password' } });
    expect(validateLoginInput({ name: 'X', url: '', username: '', password: 'p' }).ok).toBe(true);
  });
  it('enforces the limits', () => {
    const r = validateLoginInput({ name: 'n'.repeat(101), url: '', username: 'u'.repeat(201), password: 'p'.repeat(1001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['name', 'password', 'username']);
  });
});

describe('timestamps and edits', () => {
  it('a change is always later than the version it replaces, even with a clock behind', () => {
    expect(nextTimestamp(new Date('2026-11-20T09:00:00.000Z'), '2026-11-20T10:00:00.000Z')).toBe('2026-11-20T10:00:00.001Z');
    expect(nextTimestamp(t0)).toBe(t0.toISOString());
  });
  it('create, update, delete and undo', () => {
    const a = createLogin({ name: 'A', url: '', username: '', password: 'p' }, t0, 'x');
    expect(a).toMatchObject({ id: 'x', createdAt: a.updatedAt });
    const b = updateLogin(a, { name: 'B', url: '', username: '', password: 'q' }, new Date(t0.getTime() + 1000));
    expect(b).toMatchObject({ id: 'x', name: 'B', createdAt: a.createdAt });
    const gone = deleteLogin(b, new Date(t0.getTime() + 2000));
    expect(gone).toEqual({ id: 'x', deleted: true, updatedAt: '2026-11-20T10:00:02.000Z' });
    const back = restoreLogin(b, gone, new Date(t0.getTime() + 2000));
    expect(Date.parse(back.updatedAt)).toBeGreaterThan(Date.parse(gone.updatedAt));
    expect(upsertEntry([a], gone)).toEqual([gone]);
    expect(upsertEntry([], a)).toEqual([a]);
  });
});

describe('payload schema', () => {
  it('accepts logins and tombstones, rejects duplicate ids and bad timestamps', () => {
    const tomb = { id: 'id-2', deleted: true, updatedAt: t0.toISOString() };
    expect(PayloadSchema.safeParse({ schemaVersion: 1, logins: [login(), tomb] }).success).toBe(true);
    expect(PayloadSchema.safeParse({ schemaVersion: 1, logins: [login(), login()] }).success).toBe(false);
    expect(PayloadSchema.safeParse({ schemaVersion: 1, logins: [login({ updatedAt: 'yesterday' })] }).success).toBe(false);
    expect(PayloadSchema.safeParse({ schemaVersion: 2, logins: [] }).success).toBe(false);
  });
});

describe('site matching', () => {
  it('reads hosts from all the usual URL shapes', () => {
    expect(hostOf('https://www.Amazon.de/ap/signin?x=1')).toBe('amazon.de');
    expect(hostOf('amazon.de/login')).toBe('amazon.de');
    expect(hostOf('http://192.168.1.1:8080/')).toBe('192.168.1.1');
    expect(hostOf('android://AbCd==@com.example.bank/')).toBe('com.example.bank');
    expect(hostOf('')).toBe('');
    expect(hostOf('not a url at all')).toBe('');
  });
  it('falls back to the folded name without a URL', () => {
    expect(siteKey({ name: '  Café   Bank ', url: '' })).toBe('cafe bank');
    expect(siteKey({ name: 'Whatever', url: 'https://www.bank.de' })).toBe('bank.de');
  });
  it('fold removes accents, case and extra spaces', () => {
    expect(fold('  Ärzte  Zürich ')).toBe('arzte zurich');
  });
});

describe('sort and search', () => {
  const list = [
    login({ id: '1', name: 'zalando', url: 'zalando.de' }),
    login({ id: '2', name: 'Ärztekammer', username: 'doc', url: '' }),
    login({ id: '3', name: 'amazon', username: 'b' }),
    login({ id: '4', name: 'Amazon', username: 'a', url: '' }),
  ];
  it('sorts by name ignoring case and accents, then username', () => {
    expect(sortLogins(list).map((l) => l.id)).toEqual(['4', '3', '2', '1']);
  });
  it('matches every word in name, URL or username', () => {
    expect(searchLogins(list, 'arzte').map((l) => l.id)).toEqual(['2']);
    expect(searchLogins(list, 'amazon a').map((l) => l.id).sort()).toEqual(['3', '4']);
    expect(searchLogins(list, 'zalando.de').map((l) => l.id)).toEqual(['1']);
    expect(searchLogins(list, 'DOC ärzte').map((l) => l.id)).toEqual(['2']);
    expect(searchLogins(list, 'example.com zal').map((l) => l.id)).toEqual(['1']);
    expect(searchLogins(list, 'amazon zalando')).toEqual([]);
    expect(searchLogins(list, '  ')).toHaveLength(4);
  });
});

describe('urlForOpening', () => {
  it('adds https and only opens web links', () => {
    expect(urlForOpening('amazon.de')).toBe('https://amazon.de/');
    expect(urlForOpening('localhost:8080/x')).toBe('https://localhost:8080/x');
    expect(urlForOpening('http://router.local')).toBe('http://router.local/');
    expect(urlForOpening('javascript:alert(1)')).toBeNull();
    expect(urlForOpening('android://x@com.app/')).toBeNull();
    expect(urlForOpening('')).toBeNull();
  });
});

describe('master password', () => {
  it('needs 12 characters, no outer spaces, and a matching confirmation', () => {
    expect(masterPasswordProblem('short')).toMatch(/at least 12/);
    expect(masterPasswordProblem('🔑'.repeat(12))).toBeNull();
    expect(masterPasswordProblem(' twelve chars x')).toMatch(/space/);
    expect(masterPasswordProblem('long enough pw', 'long enough pW')).toMatch(/match/);
    expect(masterPasswordProblem('Café au lait!!', 'Café au lait!!')).toBeNull();
  });
});
