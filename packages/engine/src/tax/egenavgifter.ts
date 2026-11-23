import type { RuleSet } from '@lyvan/rules';
import { solveIncreasing } from '../core/solver';

/** Nedsättning of egenavgifter on a contribution base. */
export function egenavgifterReduction(base: number, rules: RuleSet): number {
  const e = rules.egenavgifter;
  return Math.min(e.reductionMax, e.reductionRate * Math.min(Math.max(0, base), e.reductionBaseCap));
}

export interface EgenavgifterResult {
  /** Egenavgifter paid. */
  amount: number;
  /** Contribution base (surplus after egenavgifter). */
  base: number;
  /** Nedsättning applied. */
  reduction: number;
  /** Surplus after egenavgifter = earned income for income tax. */
  income: number;
}

/**
 * Egenavgifter are deductible from their own base, so the exact result is a fixed point:
 * EA = rate * base - reduction(base), with base = surplus - EA.
 */
export function egenavgifter(surplus: number, rules: RuleSet): EgenavgifterResult {
  if (surplus <= 0) return { amount: 0, base: 0, reduction: 0, income: Math.min(0, surplus) };
  const f = (ea: number): number => {
    const base = surplus - ea;
    return ea - (rules.egenavgifter.standard * base - egenavgifterReduction(base, rules));
  };
  const res = solveIncreasing(f, 0, 0, surplus, 0.001);
  const amount = res.x;
  const base = surplus - amount;
  return { amount, base, reduction: egenavgifterReduction(base, rules), income: base };
}
