import { describe, expect, it } from 'vitest';
import { backupStatus, daysAgo, formatDateTime } from './backupStatus';

const now = new Date('2026-11-18T12:00:00Z');

describe('backupStatus', () => {
  it('never, ok and overdue', () => {
    expect(backupStatus(null, 14, now)).toEqual({ state: 'never', days: 0 });
    expect(backupStatus('2026-11-18T08:00:00Z', 14, now)).toEqual({ state: 'ok', days: 0 });
    expect(backupStatus('2026-11-05T12:00:00Z', 14, now)).toEqual({ state: 'ok', days: 13 });
    expect(backupStatus('2026-11-04T12:00:00Z', 14, now)).toEqual({ state: 'overdue', days: 14 });
  });
  it('treats an unreadable date as never', () => {
    expect(backupStatus('garbage', 14, now).state).toBe('never');
  });
  it('words', () => {
    expect([0, 1, 5].map(daysAgo)).toEqual(['today', 'yesterday', '5 days ago']);
  });
});

describe('formatDateTime', () => {
  it('uses the house style in local time', () => {
    const local = new Date(2026, 10, 18, 9, 5).toISOString();
    expect(formatDateTime(local)).toBe('Wed, 18-11-2026 · 09:05');
    expect(formatDateTime(local, false)).toBe('Wed, 18-11-2026');
  });
});
