import { EngineInputError, scenarios, sweep, type ScenarioFailure, type ScenarioId } from '@lyvan/engine';
import { toCommonInput, type Inputs } from '../../state/model';
import { resolveRules } from '../../state/useResults';

/** 300 000 ... 3 000 000 in steps of 100 000. */
export const SWEEP_REVENUES: number[] = Array.from({ length: 28 }, (_, i) => 300_000 + i * 100_000);

export interface Crossover {
  x: number;
  y: number;
  id: ScenarioId;
}

export interface SweepData {
  /** One row per revenue: `{ revenue, <scenarioId>: netCash, ... }` (invalid scenarios are left out). */
  rows: Record<string, number>[];
  crossovers: Crossover[];
  failures: ScenarioFailure[];
  /** Scenarios that have a series. */
  ids: ScenarioId[];
}

/** Evaluate every scenario over the revenue range. A scenario with invalid settings is reported, not thrown. */
export function computeSweep(inputs: Inputs, taxYear: number): SweepData {
  const rules = resolveRules(taxYear);
  const common = toCommonInput(inputs, rules.year);
  const series: Partial<Record<ScenarioId, number[]>> = {};
  const failures: ScenarioFailure[] = [];
  for (const s of scenarios) {
    try {
      series[s.id] = sweep(s.id, { common, options: inputs.options[s.id] ?? {} }, SWEEP_REVENUES, rules).map((p) => p.netCash);
    } catch (e) {
      if (!(e instanceof EngineInputError)) throw e;
      failures.push({ scenarioId: s.id, issues: e.issues, scope: e.scope });
    }
  }
  const ids = scenarios.map((s) => s.id).filter((id) => series[id] !== undefined);
  const rows = SWEEP_REVENUES.map((revenue, i) => {
    const row: Record<string, number> = { revenue };
    for (const id of ids) row[id] = series[id]![i]!;
    return row;
  });
  const crossovers: Crossover[] = [];
  let prev: ScenarioId | null = null;
  for (const row of rows) {
    const leader = ids.reduce((best, id) => (row[id]! > row[best]! ? id : best), ids[0]!);
    if (ids.length > 0 && prev !== null && leader !== prev) crossovers.push({ x: row.revenue!, y: row[leader]!, id: leader });
    prev = ids.length > 0 ? leader : null;
  }
  return { rows, crossovers, failures, ids };
}

/** The sweep ignores `revenue` itself, so typing a new revenue must not recompute it. */
export function sweepKey(inputs: Inputs, taxYear: number): string {
  return JSON.stringify([taxYear, inputs.overhead, inputs.birthYear, inputs.municipalRatePct, inputs.municipalityCode, inputs.churchMember, inputs.options]);
}

let last: { key: string; value: SweepData } | null = null;

export function computeSweepCached(inputs: Inputs, taxYear: number): SweepData {
  const key = sweepKey(inputs, taxYear);
  if (last && last.key === key) return last.value;
  const value = computeSweep(inputs, taxYear);
  last = { key, value };
  return value;
}
