import type { RuleSet } from '@lyvan/rules';
import type { ResolvedCommon } from '../../common';
import { roundKr } from '../../core/money';
import type { ScenarioResult } from '../../types';
import { buildOwnAb, computeOwnAb, maxAffordableSalary } from './compute';
import type { OwnAbOptions } from './schema';

export interface Objective {
  /** Value of 1 kr pension premium vs 1 kr net cash. */
  pensionWeight: number;
  /** Value of 1 kr retained in the AB vs 1 kr net cash. */
  retainedWeight: number;
}

export interface CurvePoint {
  salary: number;
  objective: number;
  netCash: number;
  pensionValue: number;
  retained: number;
}

export interface OptimizeResult {
  salary: number;
  objective: number;
  result: ScenarioResult;
  curve: CurvePoint[];
  maxSalary: number;
}

/** Objective at one salary, from the cheap number-only calculation (no waterfall). */
function evaluate(
  common: ResolvedCommon,
  opts: OwnAbOptions,
  rules: RuleSet,
  salary: number,
  obj: Objective,
): CurvePoint {
  const c = computeOwnAb(common, opts, rules, salary);
  const netCash = c.netSalary + c.netDividend;
  return {
    salary,
    netCash,
    pensionValue: c.premium,
    retained: c.retained,
    objective: netCash + obj.pensionWeight * c.premium + obj.retainedWeight * c.retained,
  };
}

/**
 * Find the salary that maximises netCash + w_p * pension + w_r * retained.
 * Coarse grid (10 000 kr) over [0, max affordable salary], then repeated local refinement.
 */
export function optimizeOwnAb(
  common: ResolvedCommon,
  opts: OwnAbOptions,
  rules: RuleSet,
  objective?: Objective,
): OptimizeResult {
  const obj: Objective = objective ?? {
    pensionWeight: opts.pensionWeight,
    retainedWeight: opts.retainedWeight,
  };
  const maxSalary = roundKr(maxAffordableSalary(common, opts, rules));
  const curve: CurvePoint[] = [];
  const step0 = 10_000;
  for (let s = 0; s <= maxSalary; s += step0) {
    curve.push(evaluate(common, opts, rules, s, obj));
  }
  if (curve.length === 0 || curve[curve.length - 1]!.salary !== maxSalary) {
    curve.push(evaluate(common, opts, rules, maxSalary, obj));
  }
  let best = curve.reduce((b, p) => (p.objective > b.objective ? p : b), curve[0]!);

  let step = step0;
  while (step > 10) {
    const lo = Math.max(0, best.salary - step);
    const hi = Math.min(maxSalary, best.salary + step);
    const next = Math.max(10, Math.floor(step / 10));
    for (let s = lo; s <= hi; s += next) {
      const p = evaluate(common, opts, rules, s, obj);
      if (p.objective > best.objective) best = p;
    }
    step = next;
  }
  curve.sort((a, b) => a.salary - b.salary);
  return {
    salary: best.salary,
    objective: best.objective,
    result: buildOwnAb(common, opts, rules, best.salary),
    curve,
    maxSalary,
  };
}
