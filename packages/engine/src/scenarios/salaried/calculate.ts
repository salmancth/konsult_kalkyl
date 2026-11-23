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
import { salariedSchema, type SalariedOptions } from './schema';

export function calculateSalaried(
  common: ResolvedCommon,
  opts: SalariedOptions,
  rules: RuleSet,
): ScenarioResult {
  const retention = common.revenue * opts.firmRetentionPct;
  const params: EmployeeParams = {
    budget: common.revenue - retention,
    holiday: opts.holidayModel,
    pension: opts.pensionModel,
    loneVaxling: 0,
    person: common.person,
    taxYear: common.taxYear,
    rules,
  };
  const emp = solveEmployee(params);

  const wf = new Waterfall(common.revenue, 'net_cash');
  wf.add('firm_retention', retention, 'company', 'fee', {
    formula: `${fmtPct(opts.firmRetentionPct)} × ${fmtKr(common.revenue)} (sales, bench risk, overhead, profit)`,
  });
  addEmployeeLines(wf, emp, params);

  return makeResult({
    scenarioId: 'salaried',
    common,
    rules,
    wf,
    grossPayout: emp.gross,
    warnings: employeeWarnings(emp, params, getBrytpunkt(rules, common.person)),
    assumptions: ['assumption.overhead_paid_by_firm', 'assumption.bench_risk_firm', 'assumption.pension_on_base_salary'],
    details: { salary: emp.salary, holidayPay: emp.holidayPay, gross: emp.gross },
  });
}

export const salariedScenario: ScenarioDefinition<SalariedOptions> = {
  id: 'salaried',
  labelKey: 'scenario.salaried.label',
  descriptionKey: 'scenario.salaried.description',
  inputSchema: salariedSchema,
  defaults: () => salariedSchema.parse({}),
  calculate: calculateSalaried,
};
