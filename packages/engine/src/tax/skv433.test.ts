import { readFileSync } from 'node:fs';
import { SE_2026 } from '@lyvan/rules';
import { describe, expect, it } from 'vitest';
import type { ResolvedPerson } from '../common';
import { brytpunkt, earnedIncomeCredit, evalTiers, grundavdrag, incomeTax, isSenior, jobbskatteavdrag, publicServiceFee } from './personalIncomeTax';

/**
 * Golden tests: every expected value is a figure printed in Skatteverket's SKV 433 (2026), see
 * fixtures/se-2026/skv433-examples.json. These are exact (0 kr tolerance).
 */
interface Fixture {
  municipalTaxRate: number;
  grundavdrag: { earnedIncome: number; expected: number; ref: string }[];
  grundavdragSenior: { earnedIncome: number; expected: number; ref: string }[];
  jobbskatteavdrag: { earnedIncome: number; expected: number; ref: string }[];
  stateTax: { taxableIncome: number; expected: number; ref: string }[];
  publicPensionFee: { earnedIncome: number; expected: number; ref: string }[];
  publicServiceFee: { taxableIncome: number; expected: number; ref: string }[];
  earnedIncomeCredit: { taxableIncome: number; expected: number; ref: string }[];
  brytpunkt: { expected: number };
}

const fx = JSON.parse(
  readFileSync(new URL('../../../../fixtures/se-2026/skv433-examples.json', import.meta.url), 'utf8'),
) as Fixture;

// Table 34 in the document: KI = 32.84 %, burial/church are included separately -> 0 here.
const person: ResolvedPerson = {
  birthYear: 1985,
  municipalTaxRate: fx.municipalTaxRate,
  churchMember: false,
  churchFeeRate: 0,
  burialFeeRate: 0,
};

describe('SKV 433 (2026) worked examples', () => {
  for (const c of fx.grundavdrag) {
    it(`grundavdrag at ${c.earnedIncome} (${c.ref})`, () => {
      expect(grundavdrag(c.earnedIncome, SE_2026)).toBe(c.expected);
    });
  }
  for (const c of fx.grundavdragSenior) {
    it(`förhöjt grundavdrag (66+) at ${c.earnedIncome} (${c.ref})`, () => {
      expect(grundavdrag(c.earnedIncome, SE_2026, true)).toBe(c.expected);
    });
  }
  for (const c of fx.jobbskatteavdrag) {
    it(`jobbskatteavdrag at ${c.earnedIncome} (${c.ref})`, () => {
      expect(incomeTax(c.earnedIncome, person, SE_2026).jobbskatteavdrag).toBe(c.expected);
    });
  }
  for (const c of fx.stateTax) {
    it(`state tax at taxable income ${c.taxableIncome} (${c.ref})`, () => {
      // pick the earned income whose taxable income is exactly the example (grundavdrag 17 400 here)
      const t = incomeTax(c.taxableIncome + 17_400, person, SE_2026);
      expect(t.taxableIncome).toBe(c.taxableIncome);
      expect(t.stateTax).toBe(c.expected);
    });
  }
  for (const c of fx.publicPensionFee) {
    it(`allmän pensionsavgift at ${c.earnedIncome} (${c.ref})`, () => {
      expect(incomeTax(c.earnedIncome, person, SE_2026).publicPensionFee).toBe(c.expected);
    });
  }
  for (const c of fx.publicServiceFee) {
    it(`public service-avgift at taxable income ${c.taxableIncome} (${c.ref})`, () => {
      expect(publicServiceFee(c.taxableIncome, SE_2026)).toBe(c.expected);
    });
  }
  for (const c of fx.earnedIncomeCredit) {
    it(`skattereduktion för förvärvsinkomst at taxable income ${c.taxableIncome} (${c.ref})`, () => {
      expect(earnedIncomeCredit(c.taxableIncome, Number.MAX_SAFE_INTEGER, SE_2026)).toBe(c.expected);
    });
  }
  it('brytpunkt equals the published figure', () => {
    expect(brytpunkt(SE_2026)).toBe(fx.brytpunkt.expected);
  });
});

describe('66+ rules (SKV 433 section 6.2 and 7.5.2)', () => {
  // Born 1959: 66 on 1 January 2026. Born 1960: still 65.
  const senior: ResolvedPerson = { ...person, birthYear: 1959 };
  const junior: ResolvedPerson = { ...person, birthYear: 1960 };

  it('applies from birth year 1959 (age at the start of the year)', () => {
    expect(isSenior(senior, SE_2026)).toBe(true);
    expect(isSenior(junior, SE_2026)).toBe(false);
  });

  it('the förhöjt grundavdrag is continuous inside every tier boundary except the first one', () => {
    // A jump at 0.91 PBB is in the document itself (0.687 PBB below, 0.885 - 0.2 x above).
    const pbb = SE_2026.pbb;
    const tiers = SE_2026.grundavdragSenior.tiers;
    for (const t of tiers.slice(2)) {
      const x = t.fromPbb * pbb;
      const below = evalTiers(tiers, x - 0.01, pbb);
      const at = evalTiers(tiers, x, pbb);
      // The document rounds its coefficients to 3-4 decimals, which leaves steps of up to
      // 0.004 PBB (about 240 kr); this only guards against a typo in a coefficient.
      expect(Math.abs(at - below), `at ${t.fromPbb} PBB`).toBeLessThan(0.005 * pbb);
    }
  });

  it('skattereduktion för arbetsinkomst follows the 66+ formula', () => {
    // Plenty of municipal tax to credit against, so only the formula is tested here.
    const jsa = (ai: number) => jobbskatteavdrag(ai, 0, person.municipalTaxRate, 1_000_000, SE_2026, true);
    expect(jsa(100_000)).toBe(22_000); // 22 % up to 1.75 PBB (103 600)
    expect(jsa(200_000)).toBe(29_599); // 0.2635 PBB + 7 % x AI = 15 599.20 + 14 000
    expect(jsa(600_000)).toBe(37_254); // 0.6293 PBB = 37 254.56 above 5.24 PBB (310 208)
    expect(jsa(0)).toBe(0);
  });

  it('the reduction is never more than the municipal tax', () => {
    const t = incomeTax(200_000, senior, SE_2026);
    expect(t.jobbskatteavdrag + t.earnedIncomeCredit).toBeLessThanOrEqual(t.municipalTax);
    expect(jobbskatteavdrag(200_000, 0, 0.3, 5_000, SE_2026, true)).toBe(5_000);
  });

  it('a 66-year-old pays less tax than a 65-year-old on the same salary', () => {
    for (const income of [150_000, 300_000, 500_000, 900_000]) {
      const a = incomeTax(income, senior, SE_2026);
      const b = incomeTax(income, junior, SE_2026);
      expect(a.grundavdrag, String(income)).toBeGreaterThan(b.grundavdrag);
      expect(a.netTax, String(income)).toBeLessThan(b.netTax);
    }
  });

  it('brytpunkt is higher for 66+ because of the higher grundavdrag', () => {
    expect(brytpunkt(SE_2026, true)).toBeGreaterThan(brytpunkt(SE_2026));
  });
});
