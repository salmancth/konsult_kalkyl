import { SE_2026 } from '@lyvan/rules';
import { calculateAll } from '@lyvan/engine';
import { describe, expect, it } from 'vitest';
import { csvFileName, resultsToCsv, safeText } from './export';

const results = calculateAll({ revenue: 1_500_000, overhead: 100_000 }, {}, SE_2026);
const base = {
  t: (k: string) => k,
  revenue: 1_500_000,
  ruleSetId: 'SE-2026',
  ruleSetVerified: false,
  disclaimer: 'Estimates only; not tax advice.',
  generatedAt: new Date('2026-11-22T10:00:00Z'),
};

describe('resultsToCsv', () => {
  it('starts with a BOM, carries the disclaimer and rule status, and has one row per line', () => {
    const csv = resultsToCsv(results, { ...base, language: 'sv' });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Estimates only; not tax advice.'.includes(';') ? '"Estimates only; not tax advice."' : 'Estimates');
    expect(csv).toContain('SE-2026');
    expect(csv).toContain('footer.unverified');
    const lineCount = results.reduce((n, r) => n + r.lines.length, 0);
    const dataRows = csv.split('\r\n').filter((r) => r.startsWith('scenario.'));
    expect(dataRows).toHaveLength(lineCount);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('uses ; and decimal commas for Swedish Excel, , and decimal points for English', () => {
    const sv = resultsToCsv(results, { ...base, language: 'sv' });
    const en = resultsToCsv(results, { ...base, language: 'en' });
    const row = (csv: string): string => csv.split('\r\n').find((r) => r.includes('line.net_cash') && r.startsWith('scenario.salaried'))!;
    expect(row(sv).split(';')).toHaveLength(7);
    expect(row(sv)).toMatch(/;\d+,\d{2};/); // pct column: 41,00
    expect(row(en)).toMatch(/,\d+\.\d{2},/);
  });

  it('writes amounts as plain numbers (no thousands separators) so spreadsheets can sum them', () => {
    const csv = resultsToCsv(results, { ...base, language: 'sv' });
    const net = results[0]!.lines.find((l) => l.key === 'revenue')!.amount;
    expect(csv).toContain(`;${net};`);
    expect(csv).not.toMatch(/\d{1,3}\s\d{3};/);
  });

  it('escapes quotes and separators inside text cells', () => {
    const r = structuredClone(results[0]!);
    r.lines[1]!.formula = 'a;b "quoted"';
    const csv = resultsToCsv([r], { ...base, language: 'sv' });
    expect(csv).toContain('"a;b ""quoted"""');
  });

  it('neutralises spreadsheet formulas in text cells (CSV injection)', () => {
    expect(safeText('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(safeText('+1')).toBe("'+1");
    expect(safeText('-1+2')).toBe("'-1+2");
    expect(safeText('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(safeText('Salary')).toBe('Salary');
    const r = structuredClone(results[0]!);
    r.lines[1]!.formula = '=1+1';
    expect(resultsToCsv([r], { ...base, language: 'en' })).toContain("'=1+1");
  });

  it('builds a dated, safe file name', () => {
    expect(csvFileName(1_500_000.4, new Date('2026-11-22T10:00:00Z'))).toBe('lyvan-payout-1500000-2026-11-22.csv');
  });
});
