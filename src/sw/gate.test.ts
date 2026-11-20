import { approve, buildFromCacheName, buildIdFor, cacheNameFor, cachesToDelete, resolveServing, stateAfterInstall, statusOf } from './gate';

const A = [{ url: 'index.html', revision: '1' }, { url: 'assets/a.js', revision: null }];
const B = [{ url: 'index.html', revision: '2' }, { url: 'assets/b.js', revision: null }];

describe('buildIdFor', () => {
  it('is stable and independent of order', () => {
    expect(buildIdFor(A)).toBe(buildIdFor([...A].reverse()));
    expect(buildIdFor(A)).toMatch(/^[0-9a-f]{14}$/);
  });
  it('differs between builds', () => {
    expect(buildIdFor(A)).not.toBe(buildIdFor(B));
  });
});

describe('cache names', () => {
  it('round-trips and ignores foreign caches', () => {
    expect(buildFromCacheName(cacheNameFor('abc'))).toBe('abc');
    expect(buildFromCacheName('passman-sw-state')).toBeNull();
  });
});

describe('gate', () => {
  const a = buildIdFor(A);
  const b = buildIdFor(B);

  it('approves the first build automatically', () => {
    const s = stateAfterInstall({ approved: null }, a);
    expect(s.approved).toBe(a);
    expect(statusOf(s, a).pending).toBeNull();
  });

  it('keeps serving the approved build when a new one installs', () => {
    const s = stateAfterInstall({ approved: a }, b);
    expect(s.approved).toBe(a);
    expect(resolveServing(s, b, () => true).build).toBe(a);
    expect(statusOf(s, b)).toEqual({ current: b, approved: a, pending: b });
  });

  it('switches only after approval of the installed build', () => {
    expect(approve({ approved: a }, b, 'something-else').ok).toBe(false);
    const r = approve({ approved: a }, b, b);
    expect(r).toEqual({ ok: true, state: { approved: b } });
    expect(resolveServing(r.state, b, () => true).build).toBe(b);
  });

  it('"later" changes nothing: the approved build stays', () => {
    const s = { approved: a };
    expect(resolveServing(s, b, () => true)).toEqual({ build: a, state: s });
  });

  it('falls back to the current build if the approved cache is gone', () => {
    expect(resolveServing({ approved: a }, b, (id) => id === b)).toEqual({ build: b, state: { approved: b } });
  });

  it('with two pending builds in a row, deletes the skipped one only', () => {
    const c = 'cccccccccccccc';
    const names = [cacheNameFor(a), cacheNameFor(b), cacheNameFor(c), 'passman-sw-state'];
    expect(cachesToDelete(names, { approved: a }, c)).toEqual([cacheNameFor(b)]);
  });
});
