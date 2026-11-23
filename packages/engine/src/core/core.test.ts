import { describe, expect, it } from 'vitest';
import { ceilTo100, clamp, floorKr, floorTo100, roundKr, roundTo100HalfDown, ageAtYearStart } from './money';
import { solveIncreasing } from './solver';
import { fmtKr, fmtPct } from './format';
import { Waterfall } from './waterfall';
import { assertReconciles, isReconciled } from './invariants';
import type { ScenarioResult } from '../types';

describe('money', () => {
  it('rounds', () => {
    expect(roundKr(1.5)).toBe(2);
    expect(Object.is(roundKr(-0.2), 0)).toBe(true);
    expect(floorTo100(643_099)).toBe(643_000);
    expect(ceilTo100(17_345.6)).toBe(17_400);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    // age at the START of the year: born 1985 -> 40 on 1 Jan 2026
    expect(ageAtYearStart(1985, 2026)).toBe(40);
    expect(ageAtYearStart(1958, 2026)).toBe(67);
    expect(ageAtYearStart(1959, 2026)).toBe(66);
  });
  it('floors to whole kronor without -0', () => {
    expect(floorKr(12.9)).toBe(12);
    expect(Object.is(floorKr(-0.4), 0)).toBe(false); // floor(-0.4) = -1
    expect(Object.is(floorKr(0.4), 0)).toBe(true);
  });
  it('rounds to 100 with exact .50 going down (allmän pensionsavgift)', () => {
    expect(roundTo100HalfDown(12_684)).toBe(12_700);
    expect(roundTo100HalfDown(12_650)).toBe(12_600);
    expect(roundTo100HalfDown(12_651)).toBe(12_700);
    expect(roundTo100HalfDown(47_112)).toBe(47_100);
  });
});

describe('solveIncreasing', () => {
  it('finds x for a linear function', () => {
    const r = solveIncreasing((x) => 2 * x, 100, 0, 1000);
    expect(r.status).toBe('ok');
    expect(r.x).toBeCloseTo(50, 1);
  });
  it('reports below / above', () => {
    expect(solveIncreasing((x) => x + 10, 5, 0, 100).status).toBe('below');
    expect(solveIncreasing((x) => x, 500, 0, 100).status).toBe('above');
  });
});

describe('format', () => {
  it('formats kronor and percent', () => {
    expect(fmtKr(1_500_000)).toBe('1\u00A0500\u00A0000');
    expect(fmtKr(-1234)).toBe('-1\u00A0234');
    expect(fmtPct(0.3142)).toBe('31.42%');
    expect(fmtPct(0.2)).toBe('20%');
    expect(fmtPct(1)).toBe('100%');
    expect(fmtPct(0.5, 0)).toBe('50%'); // zero decimals must not strip integer zeros
    expect(fmtPct(1, 0)).toBe('100%');
    expect(fmtPct(0.00292, 3)).toBe('0.292%');
    expect(fmtPct(0)).toBe('0%');
    expect(fmtKr(-0.2)).toBe('0');
  });
});

describe('Waterfall', () => {
  it('reconciles to revenue by absorbing the residual', () => {
    const wf = new Waterfall(1000, 'a');
    wf.add('a', 400.4, 'company', 'fee');
    wf.add('b', 599.4, 'consultant', 'payout');
    wf.add('zero', 0, 'state', 'tax', { hideIfZero: true });
    wf.subtotal('info', 12345, 'consultant', 'x');
    const { lines, balanceAdjustment } = wf.finish();
    const alloc = lines.filter((l) => l.kind !== 'revenue' && l.kind !== 'subtotal');
    expect(alloc.reduce((s, l) => s + l.amount, 0)).toBe(1000);
    expect(balanceAdjustment).toBe(1);
    expect(lines.find((l) => l.key === 'zero')).toBeUndefined();
    expect(lines.find((l) => l.key === 'a')?.pctOfRevenue).toBeCloseTo(0.401, 3);
  });
  it('throws when the balance line is missing', () => {
    const wf = new Waterfall(10, 'nope');
    wf.add('a', 10, 'company', 'fee');
    expect(() => wf.finish()).toThrow();
  });
  it('handles zero revenue', () => {
    const wf = new Waterfall(0, 'a');
    wf.add('a', 0, 'company', 'fee');
    expect(wf.finish().lines[1]?.pctOfRevenue).toBe(0);
  });
});

describe('assertReconciles', () => {
  const base = {
    scenarioId: 'salaried',
    lines: [
      { key: 'revenue', labelKey: '', amount: 100, party: 'consultant', kind: 'revenue', pctOfRevenue: 1 },
      { key: 'a', labelKey: '', amount: 90, party: 'company', kind: 'fee', pctOfRevenue: 0.9 },
    ],
    totals: { revenue: 100 },
  } as unknown as ScenarioResult;
  it('throws on mismatch', () => {
    expect(() => assertReconciles(base)).toThrow();
  });
  it('passes within tolerance', () => {
    expect(() => assertReconciles(base, 10)).not.toThrow();
  });
  it('rejects a balanced result whose balancing line hid a large residual', () => {
    const hidden = {
      ...base,
      lines: [
        { key: 'revenue', labelKey: '', amount: 100, party: 'consultant', kind: 'revenue', pctOfRevenue: 1 },
        { key: 'a', labelKey: '', amount: 100, party: 'company', kind: 'fee', pctOfRevenue: 1 },
      ],
      warnings: [],
      meta: { balanceAdjustment: 40 },
    } as unknown as ScenarioResult;
    expect(() => assertReconciles(hidden)).toThrow(/balancing line/);
    expect(isReconciled(hidden)).toBe(false);
    // the same residual is legitimate when the result is already flagged as an error
    const flagged = { ...hidden, warnings: [{ code: 'BUDGET_TOO_LOW', severity: 'error' }] } as unknown as ScenarioResult;
    expect(() => assertReconciles(flagged)).not.toThrow();
    expect(isReconciled(flagged)).toBe(true);
  });
});
