import { z } from 'zod';
import type { RuleSet } from '@lyvan/rules';

export const pensionModelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('itp1') }),
  z.object({ kind: z.literal('pct'), pct: z.number().min(0).max(1) }),
  /** Fixed annual premium (excl. SLP). */
  z.object({ kind: z.literal('fixed'), amount: z.number().min(0) }),
  /** Fixed total annual cost to the company including SLP. */
  z.object({ kind: z.literal('fixedCost'), totalCost: z.number().min(0) }),
  z.object({ kind: z.literal('none') }),
]);

export type PensionModel = z.infer<typeof pensionModelSchema>;

/** ITP 1 annual premium on annual gross salary: 4.5 % up to 7.5 IBB/month, 30 % above. */
export function itp1Annual(annualSalary: number, rules: RuleSet): number {
  if (annualSalary <= 0) return 0;
  const m = annualSalary / 12;
  const threshold = (rules.itp1.thresholdIbb * rules.ibb) / 12;
  return 12 * (rules.itp1.lowRate * Math.min(m, threshold) + rules.itp1.highRate * Math.max(0, m - threshold));
}

/** Särskild löneskatt on a premium. */
export function slp(premium: number, rules: RuleSet): number {
  return premium * rules.slp;
}

export interface PensionCost {
  /** Premium paid into the pension (excl. SLP). */
  premium: number;
  /** Särskild löneskatt on the premium. */
  slp: number;
}

/** Pension premium + SLP for a model on a given annual salary base (before rounding). */
export function pensionCost(model: PensionModel, salaryBase: number, rules: RuleSet): PensionCost {
  let premium = 0;
  switch (model.kind) {
    case 'itp1':
      premium = itp1Annual(salaryBase, rules);
      break;
    case 'pct':
      premium = Math.max(0, salaryBase) * model.pct;
      break;
    case 'fixed':
      premium = model.amount;
      break;
    case 'fixedCost':
      premium = model.totalCost / (1 + rules.slp);
      return { premium, slp: model.totalCost - premium };
    case 'none':
      premium = 0;
      break;
  }
  return { premium, slp: slp(premium, rules) };
}

/** Extra premium created by salary exchange (löneväxling) of `amount` gross salary. */
export function loneVaxlingPremium(amount: number, rules: RuleSet): number {
  return Math.max(0, amount) * (1 + rules.loneVaxlingUplift);
}
