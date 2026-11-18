/** Final value to integer cents: half away from zero, tolerant of float noise (1.005 → 101). */
export function toCents(value: number): number {
  const rounded = Math.round(Number((Math.abs(value) * 100).toPrecision(12)));
  const cents = value < 0 ? -rounded : rounded;
  return cents === 0 ? 0 : cents;
}

/** `€1.492,76`, `-€424,04`. Custom on purpose: Intl `es-ES` drops the separator for 4-digit numbers. */
export function formatCents(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const rest = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}€${euros},${rest}`;
}

/** Plain decimal-comma amount for CSV: `1234,50`, `-5,00`. */
export function formatCsvAmount(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** `69.8%`, `50%` (one decimal, trailing `.0` dropped). */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}
