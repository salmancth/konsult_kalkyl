import type { RuleSet } from '@lyvan/rules';
import { EngineInputError, parseInput, resolveCommon } from '../common';
import { solveIncreasing } from '../core/solver';
import { getScenario, scenarios } from '../registry';
import type { ScenarioInput } from '../scenarios/types';
import type { ScenarioId, ScenarioResult, Totals } from '../types';

/**
 * "Offer" tools: turn the calculator around. Instead of "what do I get for this revenue" they answer
 * "what revenue do I need for this pay" and "which model is best at which revenue".
 */

/**
 * What the target is measured on:
 * - `netCash`: cash in the consultant's pocket after tax.
 * - `consultantValue`: net cash + pension premiums.
 * - `totalValue`: consultantValue + money left in the consultant's own company or periodiseringsfond
 *   (not yet taxed as income, so it overstates what can be spent; useful to compare own AB fairly).
 */
export type TargetMetric = 'netCash' | 'consultantValue' | 'totalValue';

export function metricValue(totals: Totals, metric: TargetMetric): number {
  if (metric === 'totalValue') return totals.consultantValue + totals.retainedForConsultant;
  return totals[metric];
}

/** Upper search bound for the required revenue (SEK per year). */
export const MAX_SOLVE_REVENUE = 30_000_000;

export interface RevenueSolution {
  scenarioId: ScenarioId;
  /** `ok`: `revenue` reaches the target. `unreachable`: even MAX_SOLVE_REVENUE does not. */
  status: 'ok' | 'unreachable';
  /** Smallest whole-krona annual revenue that reaches the target (the search bound if unreachable). */
  revenue: number;
  /** The scenario result at `revenue`. */
  result: ScenarioResult;
}

function runScenario(
  scenarioId: ScenarioId,
  input: ScenarioInput,
  revenue: number,
  rules: RuleSet,
): ScenarioResult {
  const def = getScenario(scenarioId);
  const common = resolveCommon({ ...input.common, revenue }, rules);
  const options = parseInput(def.inputSchema, input.options ?? {}, scenarioId);
  return def.calculate(common, options, rules);
}

/**
 * Smallest annual revenue at which `scenarioId` gives the consultant at least `target` kr per year
 * (`metric`). `input.common.revenue` is ignored. Validation problems are thrown as EngineInputError.
 */
export function solveRevenueForTarget(
  scenarioId: ScenarioId,
  input: ScenarioInput,
  target: number,
  rules: RuleSet,
  metric: TargetMetric = 'netCash',
): RevenueSolution {
  if (!Number.isFinite(target) || target < 0) {
    throw new EngineInputError('offer', [
      { path: 'target', message: 'Target must be a number of 0 or more', code: 'too_small', limit: 0 },
    ]);
  }
  const f = (revenue: number): number => metricValue(runScenario(scenarioId, input, revenue, rules).totals, metric);
  const solved = solveIncreasing(f, target, 0, MAX_SOLVE_REVENUE, 0.5);
  if (solved.status === 'above') {
    return { scenarioId, status: 'unreachable', revenue: MAX_SOLVE_REVENUE, result: runScenario(scenarioId, input, MAX_SOLVE_REVENUE, rules) };
  }
  // The bisection stops within 0.5 kr; step up to the first whole krona that really reaches the target.
  let revenue = Math.max(0, Math.ceil(solved.x));
  let result = runScenario(scenarioId, input, revenue, rules);
  for (let i = 0; i < 1000 && metricValue(result.totals, metric) < target; i++) {
    revenue += 1;
    result = runScenario(scenarioId, input, revenue, rules);
  }
  return { scenarioId, status: 'ok', revenue, result };
}

export interface LeaderBand {
  scenarioId: ScenarioId;
  /** Revenue range (SEK per year) in which this scenario gives the consultant the most. */
  from: number;
  to: number;
}

export interface LeaderBandsOptions {
  from?: number;
  to?: number;
  step?: number;
  metric?: TargetMetric;
}

/**
 * Which scenario gives the consultant the most at each revenue level? Scenarios with invalid
 * options are skipped. The grid decides which leaders are noticed; the boundaries between two
 * leaders are refined to the whole krona.
 */
export function leaderBands(
  input: ScenarioInput,
  perScenario: Partial<Record<ScenarioId, unknown>>,
  rules: RuleSet,
  opts: LeaderBandsOptions = {},
): LeaderBand[] {
  const from = opts.from ?? 200_000;
  const to = opts.to ?? 4_000_000;
  const step = opts.step ?? 50_000;
  const metric = opts.metric ?? 'netCash';
  if (!(to > from) || !(step > 0)) {
    throw new EngineInputError('offer', [{ path: 'range', message: 'Invalid revenue range', code: 'custom' }]);
  }

  const valid = scenarios.filter((s) => {
    try {
      runScenario(s.id, { ...input, options: (perScenario[s.id] ?? {}) as Record<string, unknown> }, from, rules);
      return true;
    } catch (e) {
      if (e instanceof EngineInputError) return false;
      throw e;
    }
  });
  if (valid.length === 0) return [];

  const value = (id: ScenarioId, revenue: number): number => {
    const options = (perScenario[id] ?? {}) as Record<string, unknown>;
    return metricValue(runScenario(id, { ...input, options }, revenue, rules).totals, metric);
  };
  const leaderAt = (revenue: number): ScenarioId => {
    let best = valid[0]!.id;
    let bestValue = value(best, revenue);
    for (const s of valid.slice(1)) {
      const v = value(s.id, revenue);
      if (v > bestValue) {
        best = s.id;
        bestValue = v;
      }
    }
    return best;
  };

  const grid: number[] = [];
  for (let r = from; r < to; r += step) grid.push(r);
  grid.push(to);

  const bands: LeaderBand[] = [];
  let prevLeader = leaderAt(grid[0]!);
  let bandStart = grid[0]!;
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i]!;
    const leader = leaderAt(r);
    if (leader === prevLeader) continue;
    // Refine the crossing between grid[i-1] (prevLeader ahead) and r (leader ahead).
    let lo = grid[i - 1]!;
    let hi = r;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (value(leader, mid) > value(prevLeader, mid)) hi = mid;
      else lo = mid;
    }
    bands.push({ scenarioId: prevLeader, from: bandStart, to: hi });
    bandStart = hi;
    prevLeader = leader;
  }
  bands.push({ scenarioId: prevLeader, from: bandStart, to });
  return bands;
}
