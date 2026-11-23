import { SE_2026 } from '@lyvan/rules';
import { describe, expect, it } from 'vitest';
import { calculate, EngineInputError, isReconciled, leaderBands, metricValue, scenarios, solveRevenueForTarget } from '../index';
import type { ScenarioId } from '../types';

const common = { revenue: 0, overhead: 60_000, person: { birthYear: 1985, churchMember: false } };
const input = { common };
const IDS = scenarios.map((s) => s.id);

const netAt = (id: ScenarioId, revenue: number, metric: 'netCash' | 'consultantValue' = 'netCash'): number =>
  calculate(id, { common: { ...common, revenue } }, SE_2026).totals[metric];

describe('solveRevenueForTarget', () => {
  for (const id of IDS) {
    it(`${id}: finds the smallest whole-krona revenue that reaches the target`, () => {
      const target = 40_000 * 12; // 40 000 kr net per month
      const s = solveRevenueForTarget(id, input, target, SE_2026);
      expect(s.status).toBe('ok');
      expect(s.result.totals.netCash).toBeGreaterThanOrEqual(target);
      expect(netAt(id, s.revenue - 100)).toBeLessThan(target);
      expect(isReconciled(s.result)).toBe(true);
      // Nothing below the answer reaches the target (monotone, checked on a coarse grid).
      for (const back of [1_000, 10_000, 100_000]) expect(netAt(id, s.revenue - back)).toBeLessThan(target);
    });
  }

  it('can target pay including pension', () => {
    const target = 600_000;
    const net = solveRevenueForTarget('salaried', input, target, SE_2026, 'netCash');
    const value = solveRevenueForTarget('salaried', input, target, SE_2026, 'consultantValue');
    expect(value.result.totals.consultantValue).toBeGreaterThanOrEqual(target);
    // Pension counts towards the target, so less revenue is needed.
    expect(value.revenue).toBeLessThan(net.revenue);
  });

  it('totalValue also counts money left in the own company, so own AB needs less revenue', () => {
    const target = 800_000;
    const cash = solveRevenueForTarget('own-ab', input, target, SE_2026, 'netCash');
    const total = solveRevenueForTarget('own-ab', input, target, SE_2026, 'totalValue');
    expect(metricValue(total.result.totals, 'totalValue')).toBeGreaterThanOrEqual(target);
    expect(total.revenue).toBeLessThan(cash.revenue);
    // For a scenario that retains nothing the two metrics agree up to pension.
    const t = calculate('umbrella', { common: { ...common, revenue: 1_000_000 } }, SE_2026).totals;
    expect(metricValue(t, 'totalValue')).toBe(t.consultantValue + t.retainedForConsultant);
  });

  it('a higher target needs more revenue', () => {
    const a = solveRevenueForTarget('umbrella', input, 300_000, SE_2026);
    const b = solveRevenueForTarget('umbrella', input, 600_000, SE_2026);
    expect(b.revenue).toBeGreaterThan(a.revenue);
  });

  it('a target of 0 needs no revenue', () => {
    expect(solveRevenueForTarget('salaried', input, 0, SE_2026).revenue).toBeLessThanOrEqual(1);
  });

  it('reports an unreachable target instead of looping', () => {
    const s = solveRevenueForTarget('salaried', input, 1e12, SE_2026);
    expect(s.status).toBe('unreachable');
  });

  it('rejects invalid targets and invalid scenario options', () => {
    expect(() => solveRevenueForTarget('salaried', input, -1, SE_2026)).toThrow(EngineInputError);
    expect(() => solveRevenueForTarget('salaried', input, Number.NaN, SE_2026)).toThrow(EngineInputError);
    expect(() => solveRevenueForTarget('salaried', { common, options: { firmRetentionPct: 5 } }, 100_000, SE_2026)).toThrow(
      EngineInputError,
    );
  });

  it('respects the municipality and the firm cut', () => {
    const cheap = solveRevenueForTarget(
      'salaried',
      { common: { ...common, person: { ...common.person, municipalTaxRate: 0.29 } } },
      480_000,
      SE_2026,
    );
    const dear = solveRevenueForTarget(
      'salaried',
      { common: { ...common, person: { ...common.person, municipalTaxRate: 0.35 } } },
      480_000,
      SE_2026,
    );
    expect(cheap.revenue).toBeLessThan(dear.revenue);
    const greedy = solveRevenueForTarget('salaried', { common, options: { firmRetentionPct: 0.5 } }, 480_000, SE_2026);
    const modest = solveRevenueForTarget('salaried', { common, options: { firmRetentionPct: 0.2 } }, 480_000, SE_2026);
    expect(greedy.revenue).toBeGreaterThan(modest.revenue);
  });
});

describe('leaderBands', () => {
  const bands = leaderBands(input, {}, SE_2026);

  it('covers the whole range without gaps, in order', () => {
    expect(bands[0]!.from).toBe(200_000);
    expect(bands[bands.length - 1]!.to).toBe(4_000_000);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.from).toBe(bands[i - 1]!.to);
      expect(bands[i]!.scenarioId).not.toBe(bands[i - 1]!.scenarioId);
    }
  });

  it('the named leader really leads inside each band', () => {
    for (const b of bands) {
      const mid = Math.round((b.from + b.to) / 2);
      const leaderValue = netAt(b.scenarioId, mid);
      for (const id of IDS) expect(leaderValue, `${id} at ${mid}`).toBeGreaterThanOrEqual(netAt(id, mid) - 1);
    }
  });

  it('flips exactly at a band boundary', () => {
    for (let i = 1; i < bands.length; i++) {
      const before = bands[i - 1]!;
      const after = bands[i]!;
      const at = before.to;
      expect(netAt(after.scenarioId, at)).toBeGreaterThan(netAt(before.scenarioId, at));
      expect(netAt(before.scenarioId, at - 1)).toBeGreaterThanOrEqual(netAt(after.scenarioId, at - 1));
    }
  });

  it('skips a scenario with invalid options instead of failing', () => {
    const b = leaderBands(input, { salaried: { firmRetentionPct: 5 } }, SE_2026);
    expect(b.length).toBeGreaterThan(0);
    expect(b.every((x) => x.scenarioId !== 'salaried')).toBe(true);
  });

  it('rejects an empty range', () => {
    expect(() => leaderBands(input, {}, SE_2026, { from: 5, to: 5 })).toThrow(EngineInputError);
  });
});
