/*
 * Password generator (SCOPE §5.4, docs/DATA-MODEL.md §5). Uses the browser's cryptographic random source with
 * rejection sampling, so every character is equally likely.
 */

export interface GeneratorOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidLookAlikes: boolean;
}

export const LENGTH_MIN = 8;
export const LENGTH_MAX = 64;

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
/** No quotes, backslash or space: some sites reject them. */
export const SYMBOLS = '!#$%&*+-=?@^_~';
const LOOK_ALIKES = new Set('0Oo1lI');

export function characterClasses(options: GeneratorOptions): string[] {
  const strip = (set: string) => (options.avoidLookAlikes ? [...set].filter((c) => !LOOK_ALIKES.has(c)).join('') : set);
  const classes: string[] = [];
  if (options.lower) classes.push(strip(LOWER));
  if (options.upper) classes.push(strip(UPPER));
  if (options.digits) classes.push(strip(DIGITS));
  if (options.symbols) classes.push(SYMBOLS);
  return classes;
}

/** UI message, or null if a password can be generated. */
export function generatorProblem(options: GeneratorOptions): string | null {
  if (!Number.isInteger(options.length) || options.length < LENGTH_MIN || options.length > LENGTH_MAX) return `Choose a length from ${LENGTH_MIN} to ${LENGTH_MAX}`;
  if (characterClasses(options).length === 0) return 'Choose at least one kind of character';
  return null;
}

/** Uniform integer in [0, max). */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new Error('Invalid range');
  const limit = Math.floor(2 ** 32 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0]!;
    if (value < limit) return value % max;
  }
}

/** One character of every chosen kind, the rest from all of them, then shuffled. */
export function generatePassword(options: GeneratorOptions, randomInt: (max: number) => number = secureRandomInt): string {
  const problem = generatorProblem(options);
  if (problem) throw new Error(problem);
  const classes = characterClasses(options);
  const all = classes.join('');
  const pick = (set: string) => set[randomInt(set.length)]!;
  const chars = classes.map(pick);
  while (chars.length < options.length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

/** Rough strength in bits (length × log2 of the alphabet), for a hint in the UI. */
export function estimateBits(options: GeneratorOptions): number {
  const size = characterClasses(options).join('').length;
  return size > 0 ? Math.floor(options.length * Math.log2(size)) : 0;
}
