import { getRuleSet, type RuleSet } from '@lyvan/rules';
import { EngineInputError, parseInput, resolveCommon, type CommonInput, type InputIssue } from './common';
import { getScenario, scenarios } from './registry';
import type { ScenarioInput } from './scenarios/types';
import { optimizeOwnAb, type Objective, type OptimizeResult } from './scenarios/own-ab/optimize';
import { ownAbSchema } from './scenarios/own-ab/schema';
import type { ScenarioId, ScenarioResult } from './types';

export * from './types';
export * from './common';
export { scenarios, getScenario } from './registry';
export type { ScenarioDefinition, ScenarioInput } from './scenarios/types';
export type { Objective, OptimizeResult, CurvePoint } from './scenarios/own-ab/optimize';
export { assertReconciles, allocationSum, isReconciled, MAX_BALANCE_ADJUSTMENT } from './core/invariants';
export {
  incomeTax,
  marginalTaxRate,
  brytpunkt,
  earnedIncomeCredit,
  publicServiceFee,
  grundavdrag,
  jobbskatteavdrag,
} from './tax/personalIncomeTax';
export type { IncomeTaxResult } from './tax/personalIncomeTax';
export { fmtKr, fmtPct } from './core/format';
export { ENGINE_VERSION } from './scenarios/shared/result';
export { solveRevenueForTarget, leaderBands, metricValue, MAX_SOLVE_REVENUE } from './offer/offer';
export type { LeaderBand, LeaderBandsOptions, RevenueSolution, TargetMetric } from './offer/offer';
export { getRuleSet };

export interface SweepPoint {
  revenue: number;
  netCash: number;
  netPctOfRevenue: number;
  consultantValue: number;
}

/** A scenario whose options failed validation (the other scenarios are still calculated). */
export interface ScenarioFailure {
  scenarioId: ScenarioId;
  /** Always scenario-option or common-input issues; never an internal engine bug. */
  issues: InputIssue[];
  scope: string;
}

/** Calculate one scenario. Scenario options are validated with the scenario's zod schema. */
export function calculate(scenarioId: ScenarioId, input: ScenarioInput, rules: RuleSet): ScenarioResult {
  const def = getScenario(scenarioId);
  const common = resolveCommon(input.common, rules);
  const options = parseInput(def.inputSchema, input.options ?? {}, scenarioId);
  return def.calculate(common, options, rules);
}

/** Calculate all registered scenarios for the same common inputs. Throws on invalid input. */
export function calculateAll(
  common: CommonInput,
  perScenario: Partial<Record<ScenarioId, unknown>>,
  rules: RuleSet,
): ScenarioResult[] {
  return scenarios.map((s) => {
    const options = (perScenario[s.id] ?? {}) as Record<string, unknown>;
    return calculate(s.id, { common, options }, rules);
  });
}

/**
 * Like `calculateAll`, but a scenario with invalid options does not take the others down:
 * valid scenarios are returned in `results`, invalid ones in `failures`. Invalid COMMON input
 * fails every scenario (one failure per scenario). Errors that are not input validation errors
 * are re-thrown: they are bugs.
 */
export function calculateAllSettled(
  common: CommonInput,
  perScenario: Partial<Record<ScenarioId, unknown>>,
  rules: RuleSet,
): { results: ScenarioResult[]; failures: ScenarioFailure[] } {
  const results: ScenarioResult[] = [];
  const failures: ScenarioFailure[] = [];
  for (const s of scenarios) {
    const options = (perScenario[s.id] ?? {}) as Record<string, unknown>;
    try {
      results.push(calculate(s.id, { common, options }, rules));
    } catch (e) {
      if (!(e instanceof EngineInputError)) throw e;
      failures.push({ scenarioId: s.id, issues: e.issues, scope: e.scope });
    }
  }
  return { results, failures };
}

/** Evaluate a scenario over a list of revenues. */
export function sweep(
  scenarioId: ScenarioId,
  input: ScenarioInput,
  revenues: number[],
  rules: RuleSet,
): SweepPoint[] {
  return revenues.map((revenue) => {
    const r = calculate(scenarioId, { ...input, common: { ...input.common, revenue } }, rules);
    return {
      revenue,
      netCash: r.totals.netCash,
      netPctOfRevenue: r.totals.netPctOfRevenue,
      consultantValue: r.totals.consultantValue,
    };
  });
}

/** Find the best salary/dividend split for the own-AB scenario. */
export function optimize(
  scenarioId: 'own-ab',
  input: ScenarioInput,
  rules: RuleSet,
  objective?: Objective,
): OptimizeResult {
  if (scenarioId !== 'own-ab') throw new Error('optimize is only available for own-ab');
  const common = resolveCommon(input.common, rules);
  const options = parseInput(ownAbSchema, input.options ?? {}, 'own-ab');
  return optimizeOwnAb(common, options, rules, objective);
}
