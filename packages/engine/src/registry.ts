import type { ScenarioId } from './types';
import { ownAbScenario } from './scenarios/own-ab/calculate';
import { revenueShareScenario } from './scenarios/revenue-share/calculate';
import { salariedScenario } from './scenarios/salaried/calculate';
import { soleTraderScenario } from './scenarios/sole-trader/calculate';
import { umbrellaScenario } from './scenarios/umbrella/calculate';
import type { ScenarioDefinition } from './scenarios/types';

/** Scenario registry. Adding a new payout model = add a folder + register it here. */
export const scenarios: ScenarioDefinition<never>[] = [
  salariedScenario,
  revenueShareScenario,
  umbrellaScenario,
  soleTraderScenario,
  ownAbScenario,
] as unknown as ScenarioDefinition<never>[];

export function getScenario(id: ScenarioId): ScenarioDefinition<object> {
  const found = scenarios.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown scenario '${id}'`);
  return found as unknown as ScenarioDefinition<object>;
}
