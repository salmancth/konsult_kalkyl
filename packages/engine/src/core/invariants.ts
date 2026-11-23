import { NON_ALLOCATION_KINDS, type ScenarioResult } from '../types';

/** Largest rounding residual (kr) that may be absorbed by the balancing line in a healthy result. */
export const MAX_BALANCE_ADJUSTMENT = 10;

/** Sum of allocation lines (everything except 'revenue' and 'subtotal'). */
export function allocationSum(result: ScenarioResult): number {
  return result.lines
    .filter((l) => !NON_ALLOCATION_KINDS.has(l.kind))
    .reduce((s, l) => s + l.amount, 0);
}

/**
 * True when the lines add up to revenue AND the balancing line only absorbed a rounding residual.
 *
 * `Waterfall.finish()` forces the lines to sum to revenue by pushing any residual into one
 * "balance" line, so the sum alone proves nothing: a modelling bug would simply show up as a large
 * residual. A result that is already flagged as an error (budget too low, negative profit) may
 * legitimately carry a large adjustment because the balancing line then carries the shortfall.
 */
export function isReconciled(
  result: ScenarioResult,
  tolerance = 1,
  maxAdjustment = MAX_BALANCE_ADJUSTMENT,
): boolean {
  if (Math.abs(allocationSum(result) - result.totals.revenue) > tolerance) return false;
  if (result.warnings.some((w) => w.severity === 'error')) return true;
  return Math.abs(result.meta.balanceAdjustment) <= maxAdjustment;
}

/**
 * Reconciliation invariant: all allocation lines add up to revenue (within `tolerance` kr), and
 * the balancing line absorbed at most `maxAdjustment` kr of rounding. Throws on violation.
 */
export function assertReconciles(
  result: ScenarioResult,
  tolerance = 1,
  maxAdjustment = MAX_BALANCE_ADJUSTMENT,
): void {
  const sum = allocationSum(result);
  const revenue = result.totals.revenue;
  if (Math.abs(sum - revenue) > tolerance) {
    throw new Error(
      `Scenario '${result.scenarioId}' does not reconcile: allocation ${sum} vs revenue ${revenue}`,
    );
  }
  const adj = result.meta?.balanceAdjustment ?? 0;
  const flagged = (result.warnings ?? []).some((w) => w.severity === 'error');
  if (!flagged && Math.abs(adj) > maxAdjustment) {
    throw new Error(
      `Scenario '${result.scenarioId}': balancing line absorbed ${adj} kr (max ${maxAdjustment}) - a modelling error is hidden in the residual`,
    );
  }
}
