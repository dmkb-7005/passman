export type BackupState = 'ok' | 'overdue' | 'never';

const DAY_MS = 86_400_000;

/** One rule for Home and Setup, so both always agree. Overdue once the last backup is `reminderDays` old. */
export function backupStatus(lastBackupAt: string | null, reminderDays: number, now: Date = new Date()): { state: BackupState; days: number } {
  if (lastBackupAt === null || Number.isNaN(Date.parse(lastBackupAt))) return { state: 'never', days: 0 };
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(lastBackupAt)) / DAY_MS));
  return { state: days >= reminderDays ? 'overdue' : 'ok', days };
}

/** "today", "yesterday", "3 days ago" */
export function daysAgo(days: number): string {
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');

/** House date style in local time: `Wed, 18-11-2026 · 09:05` (without time: `Wed, 18-11-2026`). */
export function formatDateTime(iso: string, withTime = true): string {
  const d = new Date(iso);
  const date = `${WEEKDAYS[d.getDay()]}, ${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}`;
  return withTime ? `${date} · ${two(d.getHours())}:${two(d.getMinutes())}` : date;
}
