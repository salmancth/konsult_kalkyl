import { calculate, scenarios } from '@lyvan/engine';
import { SE_2026 } from '@lyvan/rules';
import { describe, expect, it } from 'vitest';
import { defaultInputs, toCommonInput } from '../../state/model';
import { computeOffer, computeOfferRowCached } from './computeOffer';

describe('computeOffer', () => {
  const inputs = { ...defaultInputs(), targetMonthlyNet: 50_000, hours: 1_600 };
  const data = computeOffer(inputs, 2026);

  it('solves every scenario for the target, cheapest first', () => {
    expect(data.rows).toHaveLength(scenarios.length);
    expect(data.failures).toEqual([]);
    expect(data.targetAnnual).toBe(600_000);
    const revenues = data.rows.map((r) => r.revenue);
    expect(revenues).toEqual([...revenues].sort((a, b) => a - b));
    for (const r of data.rows) {
      expect(r.status).toBe('ok');
      expect(r.result.totals.netCash).toBeGreaterThanOrEqual(600_000);
      expect(r.monthlyRevenue).toBeCloseTo(r.revenue / 12, 6);
      expect(r.hourlyRate).toBeCloseTo(r.revenue / 1_600, 6);
    }
  });

  it('the result at the solved revenue matches a direct calculation', () => {
    for (const r of data.rows) {
      const direct = calculate(
        r.scenarioId,
        { common: { ...toCommonInput(inputs, 2026), revenue: r.revenue }, options: inputs.options[r.scenarioId] ?? {} },
        SE_2026,
      );
      expect(direct.totals.netCash).toBe(r.result.totals.netCash);
    }
  });

  it('reports invalid scenario settings as failures and still solves the others', () => {
    const bad = { ...inputs, options: { ...inputs.options, salaried: { firmRetentionPct: 7 } } };
    const d = computeOffer(bad, 2026);
    expect(d.failures.map((f) => f.scenarioId)).toEqual(['salaried']);
    expect(d.rows).toHaveLength(scenarios.length - 1);
  });

  it('the single-scenario offer (used by the print sheet) equals the row of the full offer', () => {
    for (const r of data.rows) {
      const one = computeOfferRowCached(inputs, 2026, r.scenarioId);
      expect(one?.revenue).toBe(r.revenue);
      expect(one?.result.totals.netCash).toBe(r.result.totals.netCash);
    }
    const bad = { ...inputs, options: { ...inputs.options, salaried: { firmRetentionPct: 7 } } };
    expect(computeOfferRowCached(bad, 2026, 'salaried')).toBeNull();
  });

  it('has no hourly rate without hours', () => {
    const d = computeOffer({ ...inputs, hours: 0 }, 2026);
    expect(d.rows.every((r) => r.hourlyRate === null)).toBe(true);
  });

  it('pension counts towards the target when asked', () => {
    const net = computeOffer(inputs, 2026).rows.find((r) => r.scenarioId === 'salaried')!;
    const val = computeOffer({ ...inputs, targetMetric: 'consultantValue' }, 2026).rows.find((r) => r.scenarioId === 'salaried')!;
    expect(val.revenue).toBeLessThan(net.revenue);
  });

  it('computes the bands covering the revenue range', () => {
    expect(data.bands.length).toBeGreaterThan(0);
    expect(data.bands[0]!.from).toBe(200_000);
    expect(data.bands[data.bands.length - 1]!.to).toBe(4_000_000);
  });

  it('is fast enough to run on every keystroke (deferred)', () => {
    const t0 = performance.now();
    computeOffer(inputs, 2026);
    expect(performance.now() - t0).toBeLessThan(1_500);
  });
});
