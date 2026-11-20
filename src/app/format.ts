import { formatDateTime } from '../domain/backupStatus';

/** Non-breaking hyphens, so `20-11-2026` never wraps in running text. */
export function nbDate(text: string): string {
  return text.replace(/-/g, '‑');
}

/** House date style with non-breaking hyphens: `Wed, 18‑11‑2026 · 21:04`. */
export function displayDateTime(iso: string, withTime = true): string {
  return nbDate(formatDateTime(iso, withTime));
}

const two = (n: number) => String(n).padStart(2, '0');

/** Print sheet style: `Friday 20‑11‑2026, 10:15`. */
export function printDateTime(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  return `${weekday} ${nbDate(`${two(date.getDate())}-${two(date.getMonth() + 1)}-${date.getFullYear()}`)}, ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** A plain name for "Created on" (browsers don't expose the device model reliably). */
export function describeDevice(userAgent: string = navigator.userAgent): string {
  if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent) ? 'Android phone' : 'Android tablet';
  if (/Windows/i.test(userAgent)) return 'Windows computer';
  if (/iPhone|iPad/i.test(userAgent)) return 'iPhone or iPad';
  if (/Mac OS X/i.test(userAgent)) return 'Mac';
  if (/Linux/i.test(userAgent)) return 'Linux computer';
  return 'This device';
}
