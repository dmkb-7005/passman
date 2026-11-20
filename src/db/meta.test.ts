import 'fake-indexeddb/auto';
import { AppDB } from './schema';
import { DEFAULT_SETTINGS, ensureDefaults, withDefaults } from './meta';

describe('withDefaults', () => {
  it('returns the defaults for nothing stored', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps stored values and fills in missing ones, also inside generator', () => {
    const s = withDefaults({ lockIdleMinutes: 10, generator: { length: 32 } });
    expect(s.lockIdleMinutes).toBe(10);
    expect(s.lockBackgroundSeconds).toBe(60);
    expect(s.generator).toEqual({ ...DEFAULT_SETTINGS.generator, length: 32 });
  });
});

describe('ensureDefaults', () => {
  it('creates the device id once and never overwrites settings', async () => {
    const db = new AppDB(`test-${crypto.randomUUID()}`);
    await ensureDefaults(db);
    const id = (await db.meta.get('deviceId'))?.value;
    expect(typeof id).toBe('string');
    await db.meta.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, lockIdleMinutes: 2 } });
    await ensureDefaults(db);
    expect((await db.meta.get('deviceId'))?.value).toBe(id);
    expect(((await db.meta.get('settings'))?.value as { lockIdleMinutes: number }).lockIdleMinutes).toBe(2);
    db.close();
  });
});
