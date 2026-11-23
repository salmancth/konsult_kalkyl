import type { RuleSet } from '@lyvan/rules';
import type { ResolvedCommon } from '../../common';
import { fmtKr, fmtPct } from '../../core/format';
import { Waterfall } from '../../core/waterfall';
import type { ScenarioResult } from '../../types';
import {
  addEmployeeLines,
  employeeWarnings,
  solveEmployee,
  type EmployeeParams,
} from '../shared/employee';
import { getBrytpunkt, makeResult } from '../shared/result';
import type { ScenarioDefinition } from '../types';
import { umbrellaSchema, type UmbrellaOptions } from './schema';

export function calculateUmbrella(
  common: ResolvedCommon,
  opts: UmbrellaOptions,
  rules: RuleSet,
): ScenarioResult {
  const fee = common.revenue * opts.providerFeePct;
  const params: EmployeeParams = {
    budget: common.revenue - fee - common.overhead,
    holiday: 'compensation',
    pension: opts.pensionModel,
    loneVaxling: 0,
    person: common.person,
    taxYear: common.taxYear,
    rules,
  };
  const emp = solveEmployee(params);

  const wf = new Waterfall(common.revenue, 'net_cash');
  wf.add('provider_fee', fee, 'provider', 'fee', {
    formula: `${fmtPct(opts.providerFeePct)} × ${fmtKr(common.revenue)}`,
  });
  wf.add('overhead', common.overhead, 'external', 'cost', {
    hideIfZero: true,
    formula: 'Expenses deducted before salary',
  });
  addEmployeeLines(wf, emp, params);

  return makeResult({
    scenarioId: 'umbrella',
    common,
    rules,
    wf,
    grossPayout: emp.gross,
    warnings: employeeWarnings(emp, params, getBrytpunkt(rules, common.person)),
    assumptions: ['assumption.umbrella_all_employment_income', 'assumption.holiday_12pct'],
    details: { salary: emp.salary, holidayPay: emp.holidayPay, gross: emp.gross },
  });
}

export const umbrellaScenario: ScenarioDefinition<UmbrellaOptions> = {
  id: 'umbrella',
  labelKey: 'scenario.umbrella.label',
  descriptionKey: 'scenario.umbrella.description',
  inputSchema: umbrellaSchema,
  defaults: () => umbrellaSchema.parse({}),
  calculate: calculateUmbrella,
};
