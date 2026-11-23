import { describe, expect, it } from 'vitest';
import { defaultInputs } from '../../state/model';
import { SWEEP_REVENUES, computeSweep, computeSweepCached, sweepKey } from './computeSweep';

describe('computeSweep', () => {
  it('covers 300k-3M for all five scenarios and net cash grows with revenue', () => {
    const d = computeSweep(defaultInputs(), 2026);
    expect(d.rows).toHaveLength(SWEEP_REVENUES.length);
    expect(SWEEP_REVENUES[0]).toBe(300_000);
    expect(SWEEP_REVENUES[SWEEP_REVENUES.length - 1]).toBe(3_000_000);
    expect(d.ids).toHaveLength(5);
    expect(d.failures).toEqual([]);
    for (const id of d.ids) {
      for (let i = 1; i < d.rows.length; i++) expect(d.rows[i]![id]!).toBeGreaterThanOrEqual(d.rows[i - 1]![id]! - 2);
    }
  });

  it('reports a scenario with invalid settings instead of throwing, and keeps the others', () => {
    const inputs = defaultInputs();
    inputs.options = { ...inputs.options, 'sole-trader': { periodiseringsfondPct: -1 } };
    const d = computeSweep(inputs, 2026);
    expect(d.failures.map((f) => f.scenarioId)).toEqual(['sole-trader']);
    expect(d.ids).toHaveLength(4);
    expect(d.rows[0]).not.toHaveProperty('sole-trader');
  });

  it('survives every scenario failing (no series at all)', () => {
    const d = computeSweep({ ...defaultInputs(), birthYear: 3000 }, 2026);
    expect(d.ids).toEqual([]);
    expect(d.crossovers).toEqual([]);
    expect(d.failures).toHaveLength(5);
  });

  it('crossovers are points where the leading scenario changes', () => {
    const d = computeSweep(defaultInputs(), 2026);
    for (const c of d.crossovers) {
      const row = d.rows.find((r) => r.revenue === c.x)!;
      expect(Math.max(...d.ids.map((id) => row[id]!))).toBe(c.y);
    }
  });

  it('the cache key ignores revenue (typing a revenue must not recompute the sweep) but not other inputs', () => {
    const a = defaultInputs();
    expect(sweepKey({ ...a, revenue: 2_000_000 }, 2026)).toBe(sweepKey(a, 2026));
    expect(sweepKey({ ...a, revenueMode: 'hourly', hourlyRate: 5, hours: 5 }, 2026)).toBe(sweepKey(a, 2026));
    expect(sweepKey({ ...a, overhead: 5 }, 2026)).not.toBe(sweepKey(a, 2026));
    expect(sweepKey(a, 2027)).not.toBe(sweepKey(a, 2026));
    expect(computeSweepCached({ ...a, revenue: 1 }, 2026)).toBe(computeSweepCached({ ...a, revenue: 2 }, 2026));
  });

  it('is fast enough to run on the UI thread even with the own-AB optimizer strategy', () => {
    const inputs = defaultInputs();
    inputs.options = { ...inputs.options, 'own-ab': { salaryStrategy: 'optimize' } };
    const t0 = performance.now();
    computeSweep(inputs, 2026);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
