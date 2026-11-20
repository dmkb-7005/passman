import { estimateBits, generatePassword, generatorProblem, secureRandomInt, SYMBOLS, type GeneratorOptions } from './generator';
import { lockReason, msUntilIdleLock } from './autolock';

const defaults: GeneratorOptions = { length: 20, lower: true, upper: true, digits: true, symbols: true, avoidLookAlikes: true };

describe('generatePassword', () => {
  it('has the requested length and at least one character of every chosen kind', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword({ ...defaults, length: 8 });
      expect(pw).toHaveLength(8);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect([...pw].some((c) => SYMBOLS.includes(c))).toBe(true);
    }
  });

  it('uses only allowed characters and avoids look-alikes', () => {
    const pw = Array.from({ length: 50 }, () => generatePassword({ ...defaults, length: 64 })).join('');
    expect(pw).not.toMatch(/[0Oo1lI]/);
    expect(pw).toMatch(/^[A-Za-z0-9!#$%&*+\-=?@^_~]+$/);
    expect(generatePassword({ ...defaults, avoidLookAlikes: false, upper: false, symbols: false, lower: false, length: 64 })).toMatch(/^[0-9]{64}$/);
  });

  it('is roughly uniform over the alphabet', () => {
    const counts = new Map<string, number>();
    const opts = { ...defaults, upper: false, digits: false, symbols: false, length: 64 };
    for (let i = 0; i < 500; i++) for (const c of generatePassword(opts)) counts.set(c, (counts.get(c) ?? 0) + 1);
    // 24 letters (a–z without l and o), 32 000 draws → about 1 333 each
    expect(counts.size).toBe(24);
    for (const n of counts.values()) expect(n).toBeGreaterThan(1100), expect(n).toBeLessThan(1600);
  });

  it('validates options', () => {
    expect(generatorProblem({ ...defaults, length: 7 })).toMatch(/length/);
    expect(generatorProblem({ ...defaults, length: 65 })).toMatch(/length/);
    expect(generatorProblem({ ...defaults, lower: false, upper: false, digits: false, symbols: false })).toMatch(/at least one/);
    expect(() => generatePassword({ ...defaults, length: 3 })).toThrow();
  });

  it('estimates strength', () => {
    expect(estimateBits({ ...defaults, upper: false, digits: false, symbols: false, avoidLookAlikes: false, length: 10 })).toBe(47);
  });

  it('secureRandomInt stays in range', () => {
    for (let i = 0; i < 1000; i++) {
      const n = secureRandomInt(3);
      expect(n === 0 || n === 1 || n === 2).toBe(true);
    }
    expect(() => secureRandomInt(0)).toThrow();
  });
});

describe('auto-lock', () => {
  const base = { now: 1_000_000, lastActivity: 1_000_000, hiddenSince: null, idleMinutes: 5, backgroundSeconds: 60 };
  it('locks after the idle time', () => {
    expect(lockReason({ ...base, now: base.now + 5 * 60_000 - 1 })).toBeNull();
    expect(lockReason({ ...base, now: base.now + 5 * 60_000 })).toBe('idle');
    expect(msUntilIdleLock({ ...base, now: base.now + 60_000 })).toBe(4 * 60_000);
  });
  it('locks after the time in the background, or immediately with 0', () => {
    expect(lockReason({ ...base, hiddenSince: base.now, now: base.now + 59_000 })).toBeNull();
    expect(lockReason({ ...base, hiddenSince: base.now, now: base.now + 60_000 })).toBe('background');
    expect(lockReason({ ...base, backgroundSeconds: 0, hiddenSince: base.now })).toBe('background');
  });
});
