import { isLogin, type Entry, type Login } from './logins';
import { mergeEntries } from './merge';
import { applyRestore, planRestore } from './restore';

const t = (d: string) => `2026-11-${d}T10:00:00.000Z`;
const login = (id: string, over: Partial<Login> = {}): Login => ({
  id, name: id.toUpperCase(), url: `https://${id}.example`, username: 'me', password: `pw-${id}`, createdAt: t('01'), updatedAt: t('10'), ...over,
});
const now = new Date(t('21'));

describe('restore', () => {
  // backup made on the 14th: a, b, c, d
  const backup: Entry[] = [login('a'), login('b'), login('c'), login('d'), { id: 'x', deleted: true, updatedAt: t('12') }];
  // since then: b edited, c deleted, e added; a and d unchanged
  const current: Entry[] = [login('a'), login('b', { password: 'changed', updatedAt: t('18') }), { id: 'c', deleted: true, updatedAt: t('19') }, login('d'), login('e', { updatedAt: t('20') })];

  it('counts what changes', () => {
    expect(planRestore(current, backup)).toEqual({
      backupCount: 4, currentCount: 4, removed: 1, added: 1, reverted: 1, same: false,
      backupLastChange: t('10'), currentLastChange: t('20'),
    });
  });

  it('makes the live logins exactly the backup’s', () => {
    const result = applyRestore(current, backup, now);
    const live = result.filter(isLogin);
    expect(live.map((l) => [l.id, l.password]).sort()).toEqual([['a', 'pw-a'], ['b', 'pw-b'], ['c', 'pw-c'], ['d', 'pw-d']]);
    expect(result.find((e) => e.id === 'e')).toMatchObject({ deleted: true });
    expect(new Set(result.map((e) => e.id)).size).toBe(result.length);
  });

  it('wins the merge on another device that still has the old state', () => {
    const restored = applyRestore(current, backup, now);
    // another device has the pre-restore state plus nothing new
    const { merged } = mergeEntries(current, restored);
    expect(merged.filter(isLogin).map((l) => l.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(merged.find((e) => e.id === 'b')).toMatchObject({ password: 'pw-b' });
  });

  it('keeps unchanged logins untouched (no needless sync churn)', () => {
    const restored = applyRestore(current, backup, now);
    expect(restored.find((e) => e.id === 'a')).toBe(current[0]);
  });

  it('a backup of a different vault replaces everything', () => {
    const other: Entry[] = [login('p'), login('q')];
    expect(planRestore(current, other)).toMatchObject({ removed: 4, added: 2, reverted: 0 });
    expect(applyRestore(current, other, now).filter(isLogin).map((l) => l.id).sort()).toEqual(['p', 'q']);
  });

  it('reports a backup identical to the vault', () => {
    expect(planRestore(backup, backup).same).toBe(true);
    expect(planRestore(current, backup).same).toBe(false);
  });
});
