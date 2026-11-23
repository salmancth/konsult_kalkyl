import { SE_2026 } from '@lyvan/rules';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  assertReconciles,
  calculate,
  calculateAll,
  calculateAllSettled,
  EngineInputError,
  getRuleSet,
  isReconciled,
  optimize,
  scenarios,
  sweep,
} from './index';
import type { ScenarioId } from './types';

const ids: ScenarioId[] = ['salaried', 'revenue-share', 'umbrella', 'sole-trader', 'own-ab'];

function run(id: ScenarioId, revenue: number, overhead = 100_000, options: Record<string, unknown> = {}) {
  return calculate(id, { common: { revenue, overhead }, options }, SE_2026);
}

describe('input validation', () => {
  it('throws a readable EngineInputError with issues and a scope', () => {
    try {
      calculate('salaried', { common: { revenue: 1_500_000 }, options: { firmRetentionPct: 1 } }, SE_2026);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineInputError);
      const err = e as EngineInputError;
      expect(err.scope).toBe('salaried');
      expect(err.issues[0]?.path).toBe('firmRetentionPct');
      expect(err.issues[0]).toMatchObject({ code: 'too_big', limit: 0.95 });
      expect(err.message).toContain('firmRetentionPct');
    }
    expect(() => calculate('salaried', { common: { revenue: -1 } }, SE_2026)).toThrow(EngineInputError);
  });
  it('calculateAllSettled isolates a scenario with invalid options', () => {
    const { results, failures } = calculateAllSettled(
      { revenue: 1_500_000, overhead: 100_000 },
      { umbrella: { providerFeePct: 0.9 } },
      SE_2026,
    );
    expect(results.map((r) => r.scenarioId)).toEqual(['salaried', 'revenue-share', 'sole-trader', 'own-ab']);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.scenarioId).toBe('umbrella');
    expect(failures[0]?.issues[0]?.path).toBe('providerFeePct');
  });
  it('calculateAllSettled reports invalid common input once per scenario', () => {
    const { results, failures } = calculateAllSettled({ revenue: -5 }, {}, SE_2026);
    expect(results).toHaveLength(0);
    expect(failures).toHaveLength(5);
    expect(failures.every((f) => f.scope === 'common')).toBe(true);
  });
});

describe('registry and API', () => {
  it('registers all five scenarios', () => {
    expect(scenarios.map((s) => s.id)).toEqual(ids);
    for (const s of scenarios) {
      expect(s.defaults(SE_2026)).toBeTruthy();
    }
  });
  it('calculateAll returns 5 reconciled results for 1.5M', () => {
    const results = calculateAll({ revenue: 1_500_000, overhead: 100_000 }, {}, SE_2026);
    expect(results).toHaveLength(5);
    for (const r of results) {
      assertReconciles(r, 0);
      expect(Math.abs(r.meta.balanceAdjustment)).toBeLessThanOrEqual(5);
      expect(r.meta.ruleSetId).toBe('SE-2026');
      expect(r.meta.ruleSetVerified).toBe(false);
      expect(r.lines.every((l) => l.labelKey.startsWith('line.'))).toBe(true);
      expect(r.totals.netCash).toBeGreaterThan(0);
    }
  });
  it('rule set lookup', () => {
    expect(getRuleSet('SE', 2026)).toBe(SE_2026);
    expect(() => getRuleSet('SE', 1999)).toThrow();
  });
  it('warns on tax-year mismatch and flags the 66+ rules', () => {
    const r = calculate(
      'umbrella',
      { common: { revenue: 800_000, taxYear: 2027, person: { birthYear: 1950, churchMember: false } } },
      SE_2026,
    );
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain('TAX_YEAR_MISMATCH');
    expect(codes).toContain('AGE_66_PLUS');
  });
});

describe('Scenario 1 - salaried', () => {
  it('company keeps the retention and salary solves the rest', () => {
    const r = run('salaried', 1_000_000, 0);
    const retention = r.lines.find((l) => l.key === 'firm_retention')!;
    expect(retention.amount).toBe(300_000);
    expect(r.totals.companyRetained).toBe(300_000);
    expect(r.totals.pensionValue).toBeGreaterThan(0);
    expect(r.totals.netPctOfRevenue).toBeGreaterThan(0.3);
    expect(r.totals.netPctOfRevenue).toBeLessThan(0.45);
  });
});

describe('Scenario 2 - revenue share', () => {
  it('ceiling: no cut, no pension, no holiday -> salary = R / 1.3142', () => {
    const r = run('revenue-share', 1_000_000, 0, {
      firmCutPct: 0,
      pensionModel: { kind: 'none' },
      holidayModel: 'none',
    });
    expect(r.meta.details.salary as number).toBeCloseTo(1_000_000 / 1.3142, -1);
    expect(Math.abs((r.meta.details.salary as number) - 1_000_000 / 1.3142)).toBeLessThanOrEqual(1);
  });
  it('overhead from pot reduces the budget', () => {
    const a = run('revenue-share', 1_000_000, 100_000, { overheadFromPot: false });
    const b = run('revenue-share', 1_000_000, 100_000, { overheadFromPot: true });
    expect(b.totals.netCash).toBeLessThan(a.totals.netCash);
    expect(b.totals.overhead).toBe(100_000);
  });
  it('salary exchange adds pension and suggests löneväxling above brytpunkt', () => {
    const base = run('revenue-share', 2_000_000, 0);
    expect(base.warnings.map((w) => w.code)).toContain('CONSIDER_LONEVAXLING');
    const lv = run('revenue-share', 2_000_000, 0, { loneVaxling: 200_000 });
    expect(lv.totals.pensionValue).toBeGreaterThan(base.totals.pensionValue);
    expect(lv.warnings.map((w) => w.code)).not.toContain('CONSIDER_LONEVAXLING');
    assertReconciles(lv, 0);
  });
});

describe('Scenario 3 - umbrella', () => {
  it('provider fee line and 12 % holiday compensation', () => {
    const r = run('umbrella', 1_000_000, 0, { providerFeePct: 0.05 });
    expect(r.totals.providerFee).toBe(50_000);
    expect(r.meta.details.holidayPay as number).toBeCloseTo((r.meta.details.salary as number) * 0.12, -1);
    expect(r.totals.pensionValue).toBe(0);
  });
});

describe('Scenario 4 - sole trader', () => {
  it('egenavgifter and net cash', () => {
    const r = run('sole-trader', 500_000, 0);
    const ea = r.lines.find((l) => l.key === 'egenavgifter')!;
    expect(ea.amount).toBeGreaterThan(100_000);
    expect(ea.amount).toBeLessThan(135_000);
    expect(r.totals.netPctOfRevenue).toBeGreaterThan(0.45);
    expect(r.totals.pensionValue).toBe(0);
  });
  it('periodiseringsfond defers part of the income but egenavgifter stay on the whole surplus', () => {
    const a = run('sole-trader', 800_000, 0);
    const b = run('sole-trader', 800_000, 0, { periodiseringsfondPct: 0.3 });
    const eaA = a.lines.find((l) => l.key === 'egenavgifter')!.amount;
    const eaB = b.lines.find((l) => l.key === 'egenavgifter')!.amount;
    expect(eaB).toBe(eaA);
    // 30 % of the income after egenavgifter is deferred
    const incomeAfterEa = 800_000 - eaA;
    expect(b.totals.retainedForConsultant).toBe(Math.round(incomeAfterEa * 0.3));
    expect(b.totals.netCash).toBeLessThan(a.totals.netCash);
    expect(b.warnings.map((w) => w.code)).toContain('PERIODISERINGSFOND_TAXED_LATER');
    assertReconciles(b, 0);
  });
  it('caps the allocation at the statutory maximum from the rule set', () => {
    const r = run('sole-trader', 800_000, 0, { periodiseringsfondPct: 0.9 });
    const capped = run('sole-trader', 800_000, 0, { periodiseringsfondPct: SE_2026.periodiseringsfond.maxPct });
    expect(r.totals.retainedForConsultant).toBe(capped.totals.retainedForConsultant);
    expect(r.warnings.map((w) => w.code)).toContain('PERIODISERINGSFOND_CAPPED');
    assertReconciles(r, 0);
  });
  it('loss', () => {
    const r = run('sole-trader', 50_000, 100_000);
    expect(r.warnings.map((w) => w.code)).toContain('NEGATIVE_PROFIT');
    assertReconciles(r, 0);
  });
});

describe('Scenario 5 - own AB', () => {
  it('reference example from the LYVAN brief reproduces exactly', () => {
    const r = run('own-ab', 1_500_000, 100_000, {
      brokerFeePct: 0,
      salaryStrategy: 'custom',
      customSalary: 660_400,
      pensionModel: { kind: 'fixedCost', totalCost: 60_000 },
      capDividendAtGransbelopp: false,
    });
    expect(r.meta.details.profitBeforeTax).toBe(472_102);
    expect(r.lines.find((l) => l.key === 'corporate_tax')!.amount).toBe(97_253);
    expect(r.lines.find((l) => l.key === 'employer_fees')!.amount).toBe(207_498);
    expect(r.meta.details.dividend).toBe(374_849);
    expect(r.meta.details.gransbelopp).toBe(330_200);
    expect(r.meta.details.excessDividend).toBe(44_649);
    expect(r.warnings.map((w) => w.code)).toContain('DIVIDEND_EXCEEDS_GRANSBELOPP');
    assertReconciles(r, 0);
  });

  it('with the cap, dividend is limited to gränsbelopp and the rest stays in the AB', () => {
    const r = run('own-ab', 1_500_000, 100_000, {
      brokerFeePct: 0,
      salaryStrategy: 'custom',
      customSalary: 660_400,
      pensionModel: { kind: 'fixedCost', totalCost: 60_000 },
    });
    expect(r.meta.details.dividend).toBe(330_200);
    expect(r.meta.details.retained).toBe(44_649);
    expect(r.totals.retainedForConsultant).toBe(44_649);
    expect(r.warnings.map((w) => w.code)).toContain('RETAINED_IN_AB');
    expect(r.warnings.map((w) => w.code)).not.toContain('DIVIDEND_EXCEEDS_GRANSBELOPP');
    assertReconciles(r, 0);
  });

  it('brytpunkt strategy pays salary up to the state-tax threshold', () => {
    const r = run('own-ab', 1_500_000, 100_000);
    expect(r.meta.details.salary).toBe(660_400);
    expect(r.lines.find((l) => l.key === 'state_tax')).toBeUndefined();
  });

  it('caps salary when the budget is too small', () => {
    const r = run('own-ab', 500_000, 100_000);
    expect(r.warnings.map((w) => w.code)).toContain('SALARY_CAPPED_BY_BUDGET');
    expect(r.meta.details.profitBeforeTax as number).toBeGreaterThanOrEqual(-1);
    assertReconciles(r, 0);
  });

  it('excess dividend above the employment cap is taxed as capital', () => {
    const r = run('own-ab', 15_000_000, 0, {
      brokerFeePct: 0,
      salaryStrategy: 'custom',
      customSalary: 660_400,
      capDividendAtGransbelopp: false,
    });
    expect(r.meta.details.excessDividend as number).toBeGreaterThan(90 * 83_400);
    assertReconciles(r, 0);
  });

  it('partner share lowers the grundbelopp', () => {
    const solo = run('own-ab', 1_500_000, 100_000);
    const partner = run('own-ab', 1_500_000, 100_000, { ownershipPct: 0.5, ownersInCompany: 2 });
    expect(partner.meta.details.gransbelopp as number).toBeLessThan(solo.meta.details.gransbelopp as number);
    expect(partner.warnings.map((w) => w.code)).toContain('PARTNER_SHARES_GRUNDBELOPP');
  });

  it('negative profit is flagged', () => {
    const r = run('own-ab', 400_000, 0, { salaryStrategy: 'custom', customSalary: 600_000 });
    expect(r.warnings.map((w) => w.code)).toContain('NEGATIVE_PROFIT');
    assertReconciles(r, 0);
  });

  it('optimizer finds a salary at least as good as brytpunkt and returns a curve', () => {
    const input = { common: { revenue: 1_500_000, overhead: 100_000 } };
    const opt = optimize('own-ab', input, SE_2026);
    const objective = (t: { netCash: number; pensionValue: number; retainedForConsultant: number }): number =>
      t.netCash + 0.6 * t.pensionValue + 0.7 * t.retainedForConsultant;
    const base = calculate('own-ab', input, SE_2026);
    expect(objective(opt.result.totals)).toBeGreaterThanOrEqual(objective(base.totals) - 1);
    expect(opt.curve.length).toBeGreaterThan(10);
    expect(opt.salary).toBeLessThanOrEqual(opt.maxSalary);
    const viaStrategy = calculate('own-ab', { ...input, options: { salaryStrategy: 'optimize' } }, SE_2026);
    expect(viaStrategy.meta.details.salary).toBe(opt.salary);
  });

  it('optimize rejects other scenarios', () => {
    expect(() => optimize('salaried' as 'own-ab', { common: { revenue: 1 } }, SE_2026)).toThrow();
  });
});

describe('sweep', () => {
  it('returns one point per revenue, monotone in net cash', () => {
    const revenues = [300_000, 600_000, 900_000, 1_500_000, 3_000_000];
    for (const id of ids) {
      const pts = sweep(id, { common: { revenue: 0, overhead: 50_000 } }, revenues, SE_2026);
      expect(pts).toHaveLength(revenues.length);
      for (let i = 1; i < pts.length; i++) {
        expect(pts[i]!.netCash).toBeGreaterThanOrEqual(pts[i - 1]!.netCash);
      }
    }
  });
});

describe('property tests', () => {
  const revenueArb = fc.integer({ min: 100_000, max: 5_000_000 });
  const overheadArb = fc.integer({ min: 0, max: 50_000 });

  it('every scenario reconciles exactly to revenue', () => {
    fc.assert(
      fc.property(revenueArb, overheadArb, (revenue, overhead) => {
        for (const id of ids) {
          const r = run(id, revenue, overhead);
          assertReconciles(r, 0); // also bounds the balancing-line residual (10 kr)
          expect(Math.abs(r.meta.balanceAdjustment)).toBeLessThanOrEqual(10);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('net cash is non-decreasing in revenue', () => {
    fc.assert(
      fc.property(revenueArb, fc.integer({ min: 1_000, max: 500_000 }), (revenue, delta) => {
        for (const id of ids) {
          const a = run(id, revenue, 30_000).totals.netCash;
          const b = run(id, revenue + delta, 30_000).totals.netCash;
          expect(b).toBeGreaterThanOrEqual(a - 2);
        }
      }),
      { numRuns: 40 },
    );
  });
});

describe('Persons aged 66+ (2026: born 1959 or earlier)', () => {
  const older = { revenue: 1_200_000, overhead: 50_000, person: { birthYear: 1959, churchMember: false } };
  const younger = { ...older, person: { birthYear: 1960, churchMember: false } };

  it('keeps every scenario reconciled, and nets more than a 65-year-old (same employer fees)', () => {
    for (const id of ['salaried', 'revenue-share', 'umbrella', 'own-ab'] as const) {
      const a = calculate(id, { common: older }, SE_2026);
      const b = calculate(id, { common: younger }, SE_2026);
      expect(isReconciled(a), id).toBe(true);
      expect(a.warnings.map((w) => w.code), id).toContain('AGE_66_PLUS');
      expect(b.warnings.map((w) => w.code), id).not.toContain('AGE_66_PLUS');
      // Own AB is left out of the comparison: its default salary follows the brytpunkt, which is
      // higher for 66+, so it pays a different salary / dividend mix (a strategy, not a tax effect).
      if (id !== 'own-ab') expect(a.totals.netCash, id).toBeGreaterThan(b.totals.netCash);
    }
  });

  it('warns that the egenavgifter reduction for born 1958 or earlier is not modelled', () => {
    const born1958 = { ...older, person: { birthYear: 1958, churchMember: false } };
    const codes = (c: typeof older) => calculate('sole-trader', { common: c }, SE_2026).warnings.map((w) => w.code);
    expect(codes(born1958)).toContain('EGENAVGIFTER_AGE_NOT_MODELLED');
    expect(codes(older)).not.toContain('EGENAVGIFTER_AGE_NOT_MODELLED');
  });
});
