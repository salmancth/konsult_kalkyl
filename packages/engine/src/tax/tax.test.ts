import { SE_2026 } from '@lyvan/rules';
import { describe, expect, it } from 'vitest';
import { resolveCommon, type ResolvedPerson } from '../common';
import { corporateTax } from './corporateTax';
import { egenavgifter, egenavgifterReduction } from './egenavgifter';
import { employerFees } from './employerFees';
import { holidayPay } from './holiday';
import { itp1Annual, loneVaxlingPremium, pensionCost } from './pension';
import {
  brytpunkt,
  earnedIncomeCredit,
  grundavdrag,
  incomeTax,
  marginalTaxRate,
  publicServiceFee,
} from './personalIncomeTax';
import { gransbelopp, splitDividend } from './threeTwelve';

const person: ResolvedPerson = resolveCommon({ revenue: 1 }, SE_2026).person;

describe('personal income tax', () => {
  it('grundavdrag tiers', () => {
    expect(grundavdrag(0, SE_2026)).toBe(0);
    expect(grundavdrag(20_000, SE_2026)).toBe(20_000); // never above income
    expect(grundavdrag(660_400, SE_2026)).toBe(17_400); // 0.293 PBB rounded up
    expect(grundavdrag(100_000, SE_2026)).toBeGreaterThan(25_000);
    // tier boundaries are continuous (+/- rounding to 100)
    const a = grundavdrag(0.99 * 59_200, SE_2026);
    const b = grundavdrag(0.99 * 59_200 + 1, SE_2026);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(100);
    const mid = grundavdrag(200_000, SE_2026); // tier 0.99-2.72 PBB
    const high = grundavdrag(400_000, SE_2026); // tier 3.11-7.88 PBB
    expect(mid).toBeGreaterThan(high - 1);
  });

  it('brytpunkt is derived from skiktgräns on taxable income', () => {
    expect(brytpunkt(SE_2026)).toBe(660_400);
    expect(incomeTax(660_400, person, SE_2026).stateTax).toBe(0);
    expect(incomeTax(660_500, person, SE_2026).stateTax).toBeGreaterThan(0);
  });

  it('components add up and tax is monotone', () => {
    let prev = -1;
    for (const fi of [0, 50_000, 240_000, 360_000, 480_000, 600_000, 660_400, 720_000, 900_000, 1_200_000]) {
      const t = incomeTax(fi, person, SE_2026);
      expect(t.netIncome).toBe(t.earnedIncome - t.netTax);
      expect(t.netTax).toBe(
        t.municipalTax +
          t.burialFee +
          t.churchFee +
          t.stateTax +
          t.publicServiceFee -
          t.jobbskatteavdrag -
          t.earnedIncomeCredit,
      );
      expect(t.netTax).toBeGreaterThanOrEqual(prev);
      prev = t.netTax;
      expect(t.jobbskatteavdrag + t.earnedIncomeCredit).toBeLessThanOrEqual(t.municipalTax);
    }
  });

  it('adds church fee and state tax above the threshold', () => {
    const church = { ...person, churchMember: true };
    const a = incomeTax(500_000, person, SE_2026);
    const b = incomeTax(500_000, church, SE_2026);
    expect(b.churchFee).toBeGreaterThan(0);
    expect(b.netTax).toBe(a.netTax + b.churchFee);
    const hi = incomeTax(900_000, person, SE_2026);
    expect(hi.stateTax).toBeGreaterThan(0);
    expect(hi.publicPensionFee).toBeGreaterThan(0);
  });

  it('marginal rate is ~52 % above brytpunkt and ~33 % below', () => {
    expect(marginalTaxRate(800_000, person, SE_2026)).toBeGreaterThan(0.5);
    expect(marginalTaxRate(800_000, person, SE_2026)).toBeLessThan(0.56);
    expect(marginalTaxRate(500_000, person, SE_2026)).toBeGreaterThan(0.3);
    expect(marginalTaxRate(500_000, person, SE_2026)).toBeLessThan(0.36);
  });
});

describe('earned-income credit and public service fee', () => {
  it('earned-income credit: 0.75 % of (taxable - 40 000), max 1 500 (SKV 433 §7.5.4)', () => {
    expect(earnedIncomeCredit(30_000, 99_999, SE_2026)).toBe(0);
    expect(earnedIncomeCredit(200_000, 99_999, SE_2026)).toBe(1_200); // official example 1
    expect(earnedIncomeCredit(400_000, 99_999, SE_2026)).toBe(1_500); // official example 2
    expect(earnedIncomeCredit(400_000, 700, SE_2026)).toBe(700); // only against municipal tax
  });
  it('public service fee is 1 % of taxable income, max 1 184 kr in 2026', () => {
    expect(publicServiceFee(100_000, SE_2026)).toBe(1_000);
    expect(publicServiceFee(175_000, SE_2026)).toBe(1_184);
    expect(publicServiceFee(5_000_000, SE_2026)).toBe(1_184);
    expect(publicServiceFee(0, SE_2026)).toBe(0);
  });
});

describe('employer fees', () => {
  it('standard 31.42 %', () => {
    expect(employerFees(1_000_000, { birthYear: 1985 }, 2026, SE_2026)).toBeCloseTo(314_200, 0);
    expect(employerFees(0, { birthYear: 1985 }, 2026, SE_2026)).toBe(0);
  });
  it('reduced only from the year the person was 67 at the START of the year (born 1958 or earlier)', () => {
    expect(employerFees(1_000_000, { birthYear: 1950 }, 2026, SE_2026)).toBeCloseTo(102_100, 0);
    expect(employerFees(1_000_000, { birthYear: 1958 }, 2026, SE_2026)).toBeCloseTo(102_100, 0);
    // born 1959 turns 67 DURING 2026 -> still the full rate (Skatteverket: 1959 or later = 31.42 %)
    expect(employerFees(1_000_000, { birthYear: 1959 }, 2026, SE_2026)).toBeCloseTo(314_200, 0);
  });
  it('youth reduction applies to born 2003-2007 only', () => {
    const full = 240_000 * 0.3142;
    for (const by of [2003, 2005, 2007]) {
      expect(employerFees(240_000, { birthYear: by }, 2026, SE_2026)).toBeLessThan(full);
    }
    for (const by of [2002, 2008]) {
      expect(employerFees(240_000, { birthYear: by }, 2026, SE_2026)).toBeCloseTo(full, 6);
    }
    // 9 months x 25 000 cap: (31.42 % - 20.81 %) x 20 000 x 9
    expect(employerFees(240_000, { birthYear: 2005 }, 2026, SE_2026)).toBeCloseTo(full - 0.1061 * 20_000 * 9, 6);
  });
});

describe('holiday', () => {
  it('computes each model', () => {
    expect(holidayPay('none', 600_000, SE_2026)).toBe(0);
    expect(holidayPay('compensation', 100_000, SE_2026)).toBeCloseTo(12_000, 6);
    expect(holidayPay('supplement-legal', 120_000, SE_2026)).toBeCloseTo(0.0043 * 25 * 10_000, 6);
    expect(holidayPay('supplement-agreement', 120_000, SE_2026)).toBeCloseTo(0.008 * 25 * 10_000, 6);
    expect(holidayPay('compensation', 0, SE_2026)).toBe(0);
  });
});

describe('pension', () => {
  it('ITP1 at brytpunkt salary', () => {
    expect(itp1Annual(660_400, SE_2026)).toBeCloseTo(38_616, -1);
    expect(itp1Annual(0, SE_2026)).toBe(0);
    // below the threshold only 4.5 %
    expect(itp1Annual(300_000, SE_2026)).toBeCloseTo(13_500, 6);
  });
  it('pension models', () => {
    expect(pensionCost({ kind: 'none' }, 500_000, SE_2026)).toEqual({ premium: 0, slp: 0 });
    expect(pensionCost({ kind: 'pct', pct: 0.1 }, 500_000, SE_2026).premium).toBe(50_000);
    expect(pensionCost({ kind: 'fixed', amount: 1000 }, 0, SE_2026).slp).toBeCloseTo(242.6, 6);
    const fc = pensionCost({ kind: 'fixedCost', totalCost: 60_000 }, 0, SE_2026);
    expect(fc.premium + fc.slp).toBeCloseTo(60_000, 6);
    expect(pensionCost({ kind: 'itp1' }, 600_000, SE_2026).slp).toBeGreaterThan(0);
  });
  it('salary exchange premium has an uplift', () => {
    expect(loneVaxlingPremium(100_000, SE_2026)).toBeCloseTo(105_800, 6);
    expect(loneVaxlingPremium(-5, SE_2026)).toBe(0);
  });
});

describe('egenavgifter', () => {
  it('is a fixed point', () => {
    const r = egenavgifter(500_000, SE_2026);
    const check =
      SE_2026.egenavgifter.standard * (500_000 - r.amount) - egenavgifterReduction(500_000 - r.amount, SE_2026);
    expect(r.amount).toBeCloseTo(check, 1);
    expect(r.income).toBeCloseTo(500_000 - r.amount, 6);
    expect(r.reduction).toBe(15_000);
  });
  it('handles zero and negative surplus', () => {
    expect(egenavgifter(0, SE_2026).amount).toBe(0);
    expect(egenavgifter(-100, SE_2026).income).toBe(-100);
  });
  it('reduction is capped', () => {
    expect(egenavgifterReduction(100_000, SE_2026)).toBe(7_500);
    expect(egenavgifterReduction(1_000_000, SE_2026)).toBe(15_000);
  });
});

describe('corporate tax / 3:12', () => {
  it('corporate tax', () => {
    expect(corporateTax(472_102, SE_2026)).toBeCloseTo(97_253.012, 2);
    expect(corporateTax(-5, SE_2026)).toBe(0);
  });
  it('gränsbelopp 2026', () => {
    const g = gransbelopp({ cashWages: 660_400, ownershipPct: 1, saved: 0 }, SE_2026);
    expect(g.grundbelopp).toBe(322_400);
    expect(g.wageBased).toBeCloseTo(7_800, 6);
    expect(g.total).toBeCloseTo(330_200, 6);
    const half = gransbelopp({ cashWages: 660_400, ownershipPct: 0.5, saved: 10_000 }, SE_2026);
    expect(half.total).toBeCloseTo(161_200 + 3_900 + 10_000, 6);
    expect(gransbelopp({ cashWages: 0, ownershipPct: 1, saved: -5 }, SE_2026).wageBased).toBe(0);
  });
  it('dividend split', () => {
    const s = splitDividend(374_849, 330_200, SE_2026);
    expect(s.excess).toBeCloseTo(44_649, 6);
    expect(s.taxWithin).toBeCloseTo(66_040, 6);
    expect(splitDividend(100, 330_200, SE_2026).excess).toBe(0);
  });
});
