import { useMemo } from 'react';
import { SE_2026, getRuleSet, listRuleSets, type RuleSet } from '@lyvan/rules';
import { calculateAllSettled, type ScenarioFailure, type ScenarioResult } from '@lyvan/engine';
import { useApp } from './store';
import { effectiveRevenue, toCommonInput, type Inputs } from './model';

export interface Computed {
  rules: RuleSet;
  /** Results of all scenarios whose settings are valid. */
  results: ScenarioResult[];
  /** Scenarios whose settings (or the common inputs) failed validation. */
  failures: ScenarioFailure[];
  revenue: number;
  /** Unexpected (non-validation) failure. Validation problems are in `failures`. */
  error: string | null;
}

/** Tax years for which a rule set exists, newest first. */
export function availableTaxYears(): number[] {
  return listRuleSets()
    .filter((r) => r.country === 'SE')
    .map((r) => r.year)
    .sort((a, b) => b - a);
}

/** The rule set for a year; falls back to the newest one when the stored year is unknown. */
export function resolveRules(taxYear: number): RuleSet {
  try {
    return getRuleSet('SE', taxYear);
  } catch {
    return listRuleSets().find((r) => r.country === 'SE') ?? SE_2026;
  }
}

export function compute(inputs: Inputs, taxYear: number): Computed {
  const rules = resolveRules(taxYear);
  const revenue = effectiveRevenue(inputs);
  try {
    const { results, failures } = calculateAllSettled(toCommonInput(inputs, rules.year), inputs.options, rules);
    return { rules, results, failures, revenue, error: null };
  } catch (e) {
    return { rules, results: [], failures: [], revenue, error: e instanceof Error ? e.message : String(e) };
  }
}

// Many components read the results; compute once per (inputs, taxYear) instead of once per component.
let last: { inputs: Inputs; taxYear: number; value: Computed } | null = null;

function computeCached(inputs: Inputs, taxYear: number): Computed {
  if (last && last.inputs === inputs && last.taxYear === taxYear) return last.value;
  const value = compute(inputs, taxYear);
  last = { inputs, taxYear, value };
  return value;
}

/** All scenario results for the current inputs (the engine is synchronous and fast). */
export function useResults(): Computed {
  const inputs = useApp((s) => s.inputs);
  const taxYear = useApp((s) => s.taxYear);
  return useMemo(() => computeCached(inputs, taxYear), [inputs, taxYear]);
}

/** The active rule set (cheap: does not run any calculation). */
export function useRules(): RuleSet {
  const taxYear = useApp((s) => s.taxYear);
  return useMemo(() => resolveRules(taxYear), [taxYear]);
}
