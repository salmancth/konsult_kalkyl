import type { RuleSet } from '@lyvan/rules';
import { ageAtYearStart } from '../core/money';
import type { ResolvedPerson } from '../common';

/**
 * Employer social contributions (arbetsgivaravgifter) on gross salary (annual).
 * Ages are measured at the START of the tax year (Skatteverket):
 * - age >= reduced.minAge (born 1958 or earlier in 2026): only ålderspensionsavgift
 * - youth (age minAge..maxAge): reduced rate on salary up to capMonthly for monthsInEffect months
 */
export function employerFees(
  grossAnnual: number,
  person: Pick<ResolvedPerson, 'birthYear'>,
  taxYear: number,
  rules: RuleSet,
): number {
  if (grossAnnual <= 0) return 0;
  const age = ageAtYearStart(person.birthYear, taxYear);
  const f = rules.employerFees;
  if (age >= f.reduced.minAge) return grossAnnual * f.reduced.rate;
  let fees = grossAnnual * f.standard;
  if (age >= f.youth.minAge && age <= f.youth.maxAge) {
    const months = f.youth.monthsInEffect;
    const monthly = Math.min(grossAnnual / 12, f.youth.capMonthly);
    fees -= (f.standard - f.youth.rate) * monthly * months;
  }
  return fees;
}
