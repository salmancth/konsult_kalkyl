import type { RuleSet } from '@lyvan/rules';
import type { ResolvedCommon } from '../../common';
import type { ScenarioResult, Warning } from '../../types';
import { getBrytpunkt } from '../shared/result';
import type { ScenarioDefinition } from '../types';
import { buildOwnAb, maxAffordableSalary } from './compute';
import { optimizeOwnAb } from './optimize';
import { ownAbSchema, type OwnAbOptions } from './schema';

export function calculateOwnAb(
  common: ResolvedCommon,
  opts: OwnAbOptions,
  rules: RuleSet,
): ScenarioResult {
  switch (opts.salaryStrategy) {
    case 'custom':
      return buildOwnAb(common, opts, rules, opts.customSalary);
    case 'optimize':
      return optimizeOwnAb(common, opts, rules).result;
    case 'brytpunkt': {
      const target = getBrytpunkt(rules, common.person);
      const cap = maxAffordableSalary(common, opts, rules);
      const warnings: Warning[] = [];
      let salary = target;
      if (cap < target) {
        salary = cap;
        warnings.push({
          code: 'SALARY_CAPPED_BY_BUDGET',
          severity: 'warning',
          params: { salary: Math.round(cap), target },
        });
      }
      return buildOwnAb(common, opts, rules, salary, warnings);
    }
  }
}

export const ownAbScenario: ScenarioDefinition<OwnAbOptions> = {
  id: 'own-ab',
  labelKey: 'scenario.own-ab.label',
  descriptionKey: 'scenario.own-ab.description',
  inputSchema: ownAbSchema,
  defaults: () => ownAbSchema.parse({}),
  calculate: calculateOwnAb,
};
