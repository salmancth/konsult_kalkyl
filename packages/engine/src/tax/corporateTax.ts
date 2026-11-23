import type { RuleSet } from '@lyvan/rules';

/** Corporate tax (bolagsskatt). Zero for losses. */
export function corporateTax(profit: number, rules: RuleSet): number {
  return Math.max(0, profit) * rules.corporateTax;
}
