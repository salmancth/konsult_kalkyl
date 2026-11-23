import { describe, expect, it } from 'vitest';
import { SE_2026, getLocalities, localRates, nationalRates } from '@lyvan/rules';
import { calculate } from './index';

const data = getLocalities(2026)!;

describe('SE-2026 localities (SCB OE0101)', () => {
  it('has all 290 municipalities and 21 counties with unique codes', () => {
    expect(data.municipalities).toHaveLength(290);
    expect(data.counties).toHaveLength(21);
    expect(new Set(data.municipalities.map((m) => m.code)).size).toBe(290);
    expect(new Set(data.municipalities.map((m) => m.name)).size).toBe(290);
  });

  it('every municipality belongs to a known county and has a plausible rate', () => {
    const counties = new Set(data.counties.map((c) => c.code));
    for (const m of data.municipalities) {
      expect(counties.has(m.county), m.name).toBe(true);
      expect(m.code.startsWith(m.county), m.name).toBe(true);
      // The person schema accepts 25-40 %; SCB's real range for 2026 is 28.9-35.7 %.
      expect(m.totalPct).toBeGreaterThan(28);
      expect(m.totalPct).toBeLessThan(36);
      // SCB: any difference is rounding.
      expect(Math.abs(m.totalPct - m.municipalPct - m.regionalPct)).toBeLessThanOrEqual(0.0101);
    }
  });

  it('matches the figures SCB published for 2026', () => {
    expect(data.national.totalPct).toBe(32.38);
    const by = (name: string) => data.municipalities.find((m) => m.name === name)!;
    expect(by('Stockholm').totalPct).toBe(30.55);
    expect(by('Österåker').totalPct).toBe(28.93); // SCB: the lowest total rate in 2026
    expect(Math.max(...data.municipalities.map((m) => m.totalPct))).toBe(35.65); // Dorotea
  });

  it('the rule set averages equal the SCB national averages', () => {
    const n = nationalRates(data);
    expect(SE_2026.municipalTaxAverage).toBe(n.municipalTaxRate);
    expect(SE_2026.burialFeeAverage).toBe(n.burialFeeRate);
    expect(SE_2026.defaultChurchFeeRate).toBe(n.churchFeeRate);
  });

  it('separates the church fee from the burial fee it includes', () => {
    const r = localRates(data, '0180')!; // Stockholm
    expect(r.municipalTaxRate).toBe(0.3055);
    expect(r.county.name).toBe('Stockholms län');
    expect(r.burialFeeRate + r.churchFeeRate).toBeCloseTo(r.county.churchInclBurialPct / 100, 6);
  });

  it('returns undefined for an unknown municipality', () => {
    expect(localRates(data, '9999')).toBeUndefined();
    expect(getLocalities(1999)).toBeUndefined();
  });

  it('a lower municipal rate gives a higher net, and a church member pays the church fee', () => {
    const low = localRates(data, '0117')!; // Österåker
    const high = localRates(data, '2425')!; // Dorotea
    const run = (r: typeof low, churchMember: boolean) =>
      calculate(
        'salaried',
        {
          common: {
            revenue: 1_200_000,
            overhead: 50_000,
            person: {
              birthYear: 1985,
              municipalTaxRate: r.municipalTaxRate,
              burialFeeRate: r.burialFeeRate,
              churchFeeRate: r.churchFeeRate,
              churchMember,
            },
          },
        },
        SE_2026,
      ).totals.netCash;
    expect(run(low, false)).toBeGreaterThan(run(high, false));
    expect(run(low, true)).toBeLessThan(run(low, false));
    // 6.7 percentage points of municipal tax on a ~600 000 kr salary is tens of thousands of kronor.
    expect(run(low, false) - run(high, false)).toBeGreaterThan(20_000);
  });
});
