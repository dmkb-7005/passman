import { describeDevice, nbDate, printDateTime } from '../app/format';
import { passwordRuns } from '../components/form/PasswordText';
import { strengthWord } from '../components/generator/GeneratorControls';
import { lastGroupMatches } from '../components/recovery/RecoveryKey';
import type { Login } from '../domain/logins';
import { groupLetter, groupLogins } from './logins/LoginsPage';
import { formatRecoveryInput } from './unlock/RecoverPage';

const login = (id: string, name: string): Login => ({ id, name, url: '', username: '', password: 'p', createdAt: '', updatedAt: '' });

describe('logins list grouping', () => {
  it('groups by the first letter without accents; other characters under #', () => {
    expect(groupLetter('Ärztekammer')).toBe('A');
    expect(groupLetter('booking.com')).toBe('B');
    expect(groupLetter('1Password')).toBe('#');
    expect(groupLetter('')).toBe('#');
  });
  it('keeps the sorted order and starts a new group when the letter changes', () => {
    const groups = groupLogins([login('1', 'Amazon'), login('2', 'Ärzte'), login('3', 'Bahn')]);
    expect(groups.map((g) => [g.letter, g.logins.length])).toEqual([['A', 2], ['B', 1]]);
  });
});

describe('recovery key input', () => {
  it('upper-cases, fixes look-alikes and inserts dashes', () => {
    expect(formatRecoveryInput('7k3m q9td 4x')).toBe('7K3M-Q9TD-4X');
    expect(formatRecoveryInput('oil-')).toBe('011');
    expect(formatRecoveryInput('a'.repeat(40))).toHaveLength(39);
  });
  it('checks the typed last group', () => {
    const key = '7K3M-Q9TD-4XWB-HN2C-RP8V-6JZE-1FKA-TS5G';
    expect(lastGroupMatches(key, 'TS5G')).toBe(true);
    expect(lastGroupMatches('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-10Z0', 'ioZo')).toBe(true);
    expect(lastGroupMatches(key, 'TS6G')).toBe(false);
  });
});

describe('password display', () => {
  it('splits letters, digits and symbols into runs', () => {
    expect(passwordRuns('G3t$ecure_2026')).toEqual([
      { kind: 'letter', text: 'G' },
      { kind: 'digit', text: '3' },
      { kind: 'letter', text: 't' },
      { kind: 'symbol', text: '$' },
      { kind: 'letter', text: 'ecure' },
      { kind: 'symbol', text: '_' },
      { kind: 'digit', text: '2026' },
    ]);
    expect(passwordRuns('pässwörd')).toEqual([{ kind: 'letter', text: 'pässwörd' }]);
  });
  it('names the strength by bits', () => {
    expect([24, 60, 85, 122].map(strengthWord)).toEqual(['weak', 'fair', 'strong', 'very strong']);
  });
});

describe('formatting', () => {
  it('uses non-breaking hyphens in dates', () => {
    expect(nbDate('20-11-2026')).toBe('20‑11‑2026');
    expect(printDateTime(new Date(2026, 10, 20, 10, 15))).toBe('Friday 20‑11‑2026, 10:15');
  });
  it('describes the device in plain words', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari')).toBe('Android phone');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; SM-X710) Safari')).toBe('Android tablet');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/157')).toBe('Windows computer');
  });
});
