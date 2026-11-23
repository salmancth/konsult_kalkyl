import {
  EngineInputError,
  leaderBands,
  scenarios,
  solveRevenueForTarget,
  type LeaderBand,
  type ScenarioFailure,
  type ScenarioId,
  type ScenarioResult,
} from '@lyvan/engine';
import { toCommonInput, type Inputs } from '../../state/model';
import { resolveRules } from '../../state/useResults';

export interface OfferRow {
  scenarioId: ScenarioId;
  /** `unreachable`: even the engine's upper search bound does not give the target. */
  status: 'ok' | 'unreachable';
  /** Annual revenue to bill to reach the target. */
  revenue: number;
  monthlyRevenue: number;
  /** Revenue / billed hours; null when no hours are set. */
  hourlyRate: number | null;
  result: ScenarioResult;
}

/** Solve one scenario for the target; throws EngineInputError when its settings are invalid. */
function solveRow(inputs: Inputs, taxYear: number, scenarioId: ScenarioId): OfferRow {
  const rules = resolveRules(taxYear);
  const common = toCommonInput(inputs, rules.year);
  const targetAnnual = Math.max(0, inputs.targetMonthlyNet) * 12;
  const sol = solveRevenueForTarget(scenarioId, { common, options: inputs.options[scenarioId] ?? {} }, targetAnnual, rules, inputs.targetMetric);
  return {
    scenarioId,
    status: sol.status,
    revenue: sol.revenue,
    monthlyRevenue: sol.revenue / 12,
    hourlyRate: inputs.hours > 0 ? sol.revenue / inputs.hours : null,
    result: sol.result,
  };
}

export interface OfferData {
  /** Sorted by the revenue needed, lowest first; unreachable targets last. */
  rows: OfferRow[];
  failures: ScenarioFailure[];
  /** Which scenario gives the consultant the most, per revenue range. */
  bands: LeaderBand[];
  targetAnnual: number;
}

/**
 * What must be billed to reach the target pay, per scenario, and which model wins at which revenue.
 * Scenarios with invalid settings are reported in `failures` and left out.
 */
export function computeOffer(inputs: Inputs, taxYear: number): OfferData {
  const rules = resolveRules(taxYear);
  const common = toCommonInput(inputs, rules.year);
  const targetAnnual = Math.max(0, inputs.targetMonthlyNet) * 12;
  const rows: OfferRow[] = [];
  const failures: ScenarioFailure[] = [];

  for (const s of scenarios) {
    try {
      rows.push(solveRow(inputs, taxYear, s.id));
    } catch (e) {
      if (!(e instanceof EngineInputError)) throw e;
      failures.push({ scenarioId: s.id, issues: e.issues, scope: e.scope });
    }
  }
  rows.sort((a, b) => Number(a.status === 'unreachable') - Number(b.status === 'unreachable') || a.revenue - b.revenue);

  let bands: LeaderBand[] = [];
  try {
    bands = leaderBands({ common }, inputs.options, rules, { metric: inputs.targetMetric });
  } catch (e) {
    if (!(e instanceof EngineInputError)) throw e;
  }
  return { rows, failures, bands, targetAnnual };
}

let last: { key: string; value: OfferData } | null = null;

/** The key of everything the offer depends on (the revenue itself is the answer, not an input). */
function offerKey(inputs: Inputs, taxYear: number): string {
  return JSON.stringify([
    taxYear,
    inputs.overhead,
    inputs.birthYear,
    inputs.municipalRatePct,
    inputs.municipalityCode,
    inputs.churchMember,
    inputs.targetMonthlyNet,
    inputs.targetMetric,
    inputs.hours,
    inputs.options,
  ]);
}

let lastRow: { key: string; scenarioId: ScenarioId; value: OfferRow | null } | null = null;

/**
 * The offer for ONE scenario (about 30 calculations): what the printable offer sheet needs, so it
 * does not redo the full comparison on every change in the other tabs. Null if the settings are invalid.
 */
export function computeOfferRowCached(inputs: Inputs, taxYear: number, scenarioId: ScenarioId): OfferRow | null {
  const key = offerKey(inputs, taxYear);
  if (lastRow && lastRow.key === key && lastRow.scenarioId === scenarioId) return lastRow.value;
  let value: OfferRow | null = null;
  try {
    value = solveRow(inputs, taxYear, scenarioId);
  } catch (e) {
    if (!(e instanceof EngineInputError)) throw e;
  }
  lastRow = { key, scenarioId, value };
  return value;
}

/** Cached by the inputs that matter, so the view and the offer sheet share one computation. */
export function computeOfferCached(inputs: Inputs, taxYear: number): OfferData {
  const key = offerKey(inputs, taxYear);
  if (last && last.key === key) return last.value;
  const value = computeOffer(inputs, taxYear);
  last = { key, value };
  return value;
}
