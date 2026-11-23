import { SE_2026 } from './se/2026';
import { LOCALITIES_2026 } from './se/localities-2026';
import type { LocalityData } from './localities';
import type { RuleSet } from './types';

export type { PbbTier, RuleSet } from './types';
export type { County, LocalityData, LocalRates, Municipality } from './localities';
export { localRates, nationalRates } from './localities';
export { SE_2026, LOCALITIES_2026 };

const registry: Record<string, RuleSet> = {
  'SE-2026': SE_2026,
};

const localityRegistry: Record<number, LocalityData> = {
  2026: LOCALITIES_2026,
};

/** Municipality / county tax data for a year, or undefined when none is bundled. */
export function getLocalities(year: number): LocalityData | undefined {
  return localityRegistry[year];
}

/** Register additional rule sets at runtime (e.g. tests or future years). */
export function registerRuleSet(ruleSet: RuleSet): void {
  registry[ruleSet.id] = ruleSet;
}

export function getRuleSet(country: 'SE', year: number): RuleSet {
  const found = registry[`${country}-${year}`];
  if (!found) {
    throw new Error(`No rule set for ${country} ${year}`);
  }
  return found;
}

export function listRuleSets(): RuleSet[] {
  return Object.values(registry);
}
