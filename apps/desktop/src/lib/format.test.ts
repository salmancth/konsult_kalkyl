import { describe, expect, it } from 'vitest';
import { formatKr, formatKrTable, formatPct, parseAmount } from './format';

describe('parseAmount', () => {
  it('parses plain, spaced, suffixed and decimal-comma input', () => {
    expect(parseAmount('1500000')).toBe(1_500_000);
    expect(parseAmount('1 500 000')).toBe(1_500_000);
    expect(parseAmount('1 500 000 kr')).toBe(1_500_000);
    expect(parseAmount('1,5M')).toBe(1_500_000);
    expect(parseAmount('1.5m')).toBe(1_500_000);
    expect(parseAmount('750k')).toBe(750_000);
    expect(parseAmount('750 tkr')).toBe(750_000);
    expect(parseAmount('1,5 mkr')).toBe(1_500_000);
    expect(parseAmount('1.500.000')).toBe(1_500_000);
    expect(parseAmount('1,500,000')).toBe(1_500_000);
  });
  it('handles decimal and thousands separators the Swedish way', () => {
    expect(parseAmount('32,38')).toBe(32.38);
    expect(parseAmount('32.38')).toBe(32.38);
    expect(parseAmount('1.500')).toBe(1_500); // thousands, not 1.5 kr
    expect(parseAmount('1.5')).toBe(1.5);
    expect(parseAmount('1.234,56')).toBe(1_234.56);
    expect(parseAmount('1,234.56')).toBe(1_234.56);
    expect(parseAmount('750kr')).toBe(750);
    expect(parseAmount('-5')).toBe(-5);
    expect(parseAmount('−5')).toBe(-5);
  });
  it('rejects garbage', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1mm')).toBeNull();
    expect(parseAmount('1.5.5')).toBeNull();
    expect(parseAmount('12,34,5')).toBeNull();
    expect(parseAmount('--5')).toBeNull();
    expect(parseAmount('k')).toBeNull();
  });
});

describe('format', () => {
  it('formats kronor and percent', () => {
    expect(formatKr(1_500_000).replace(/\s/g, ' ')).toBe('1 500 000 kr');
    expect(formatKr(-0.2, false)).toBe('0');
    expect(formatKr(-0.2)).toBe('0 kr');
    expect(formatKrTable(-1234).replace(/\s/g, ' ')).toBe('(1 234)');
    expect(formatKrTable(-0.4)).toBe('0');
    expect(formatPct(0.523)).toBe('52,3 %');
    expect(formatPct(-0.00001)).toBe('0,0 %');
    expect(formatPct(0.5, 0)).toBe('50 %');
  });
});
