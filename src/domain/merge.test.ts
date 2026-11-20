import type { Entry, Login, Tombstone } from './logins';
import { mergeEntries } from './merge';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 20, 10, minute)).toISOString();
const login = (id: string, minute: number, password = 'p'): Login => ({
  id, name: id, url: '', username: '', password, createdAt: at(0), updatedAt: at(minute),
});
const tomb = (id: string, minute: number): Tombstone => ({ id, deleted: true, updatedAt: at(minute) });
const ids = (entries: Entry[]) => entries.map((e) => `${e.id}@${e.updatedAt.slice(14, 16)}${'deleted' in e ? 'x' : ''}`);

describe('mergeEntries', () => {
  it('identical copies: nothing changes on either side', () => {
    const a = [login('a', 1), tomb('b', 2)];
    expect(mergeEntries(a, [...a].reverse())).toMatchObject({ localChanged: false, remoteChanged: false });
  });

  it('new logins on both sides are kept', () => {
    const r = mergeEntries([login('a', 1)], [login('b', 2)]);
    expect(ids(r.merged)).toEqual(['a@01', 'b@02']);
    expect(r).toMatchObject({ localChanged: true, remoteChanged: true });
  });

  it('edit vs edit: the later one wins', () => {
    const r = mergeEntries([login('a', 5, 'local')], [login('a', 3, 'remote')]);
    expect((r.merged[0] as Login).password).toBe('local');
    expect(r).toMatchObject({ localChanged: false, remoteChanged: true });
  });

  it('delete after edit wins; edit after delete brings it back', () => {
    expect(ids(mergeEntries([login('a', 1)], [tomb('a', 2)]).merged)).toEqual(['a@02x']);
    expect(ids(mergeEntries([tomb('a', 2)], [login('a', 3)]).merged)).toEqual(['a@03']);
  });

  it('a tombstone stops an offline device from bringing a deleted login back', () => {
    const phone = [tomb('a', 10)];
    const oldLaptop = [login('a', 1)];
    const r = mergeEntries(oldLaptop, phone);
    expect(ids(r.merged)).toEqual(['a@10x']);
    expect(r.remoteChanged).toBe(false);
  });

  it('equal timestamps with different content: both devices pick the same version', () => {
    const x = login('a', 4, 'x');
    const y = login('a', 4, 'y');
    expect(mergeEntries([x], [y]).merged).toEqual(mergeEntries([y], [x]).merged);
  });

  it('is order independent and idempotent', () => {
    const local = [login('a', 1), login('c', 9), tomb('d', 4)];
    const remote = [login('a', 2), login('b', 3), login('d', 3)];
    const once = mergeEntries(local, remote).merged;
    expect(mergeEntries(remote, local).merged).toEqual(once);
    expect(mergeEntries(once, remote)).toMatchObject({ merged: once, localChanged: false });
  });
});
