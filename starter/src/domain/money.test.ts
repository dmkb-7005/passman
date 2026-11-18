import { describe, expect, it } from 'vitest';
import { formatCents, formatCsvAmount, formatPercent, toCents } from './money';

describe('money', () => {
  it('rounds half away from zero, once', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(-1.005)).toBe(-101);
    expect(toCents(-0.001)).toBe(0);
  });
  it('formats euros the European way', () => {
    expect(formatCents(149276)).toBe('€1.492,76');
    expect(formatCents(-42404)).toBe('-€424,04');
    expect(formatCents(5)).toBe('€0,05');
    expect(formatCents(123456789)).toBe('€1.234.567,89');
  });
  it('CSV and percent', () => {
    expect(formatCsvAmount(-500)).toBe('-5,00');
    expect(formatPercent(69.84)).toBe('69.8%');
    expect(formatPercent(50)).toBe('50%');
  });
});
