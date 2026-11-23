import { readFileSync } from 'node:fs';
import { SE_2026 } from '@lyvan/rules';
import { describe, expect, it } from 'vitest';
import { resolveCommon } from '../common';
import { incomeTax } from './personalIncomeTax';

interface Case {
  earnedIncome: number;
  expectedNetTax: number | null;
  status: string;
}
interface Fixture {
  municipalTaxRate: number;
  toleranceKrPerYear: number;
  cases: Case[];
}

const fixture = JSON.parse(
  readFileSync(new URL('../../../../fixtures/se-2026/income-tax.json', import.meta.url), 'utf8'),
) as Fixture;

const person = resolveCommon(
  { revenue: 1, person: { birthYear: 1985, churchMember: false, municipalTaxRate: fixture.municipalTaxRate } },
  SE_2026,
).person;

describe('golden income-tax fixtures (SE-2026)', () => {
  for (const c of fixture.cases) {
    const title = `net tax at ${c.earnedIncome}`;
    if (c.expectedNetTax === null) {
      // TODO_VERIFY: official expected values not yet available - never invent numbers.
      it.skip(`${title} (TODO_VERIFY: needs Skatteverket expected value)`, () => undefined);
    } else {
      it(title, () => {
        const t = incomeTax(c.earnedIncome, person, SE_2026);
        expect(Math.abs(t.netTax - c.expectedNetTax!)).toBeLessThanOrEqual(fixture.toleranceKrPerYear);
      });
    }
  }
});
