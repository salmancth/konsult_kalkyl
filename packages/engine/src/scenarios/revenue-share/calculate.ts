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
import { revenueShareSchema, type RevenueShareOptions } from './schema';

export function calculateRevenueShare(
  common: ResolvedCommon,
  opts: RevenueShareOptions,
  rules: RuleSet,
): ScenarioResult {
  const cut = common.revenue * opts.firmCutPct;
  const overhead = opts.overheadFromPot ? common.overhead : 0;
  const params: EmployeeParams = {
    budget: common.revenue - cut - overhead,
    holiday: opts.holidayModel,
    pension: opts.pensionModel,
    loneVaxling: opts.loneVaxling,
    person: common.person,
    taxYear: common.taxYear,
    rules,
  };
  const emp = solveEmployee(params);

  const wf = new Waterfall(common.revenue, 'net_cash');
  wf.add('firm_cut', cut, 'company', 'fee', {
    formula: `${fmtPct(opts.firmCutPct)} × ${fmtKr(common.revenue)} (admin, brand, framework agreements)`,
  });
  wf.add('overhead', overhead, 'external', 'cost', {
    hideIfZero: true,
    formula: 'Overhead paid from the consultant pot',
  });
  addEmployeeLines(wf, emp, params);

  const warnings = employeeWarnings(emp, params, getBrytpunkt(rules, common.person));
  return makeResult({
    scenarioId: 'revenue-share',
    common,
    rules,
    wf,
    grossPayout: emp.gross,
    warnings: opts.loneVaxling === 0 && emp.gross > getBrytpunkt(rules, common.person)
      ? [...warnings, { code: 'CONSIDER_LONEVAXLING', severity: 'info' }]
      : warnings,
    assumptions: opts.overheadFromPot
      ? ['assumption.pot_pays_overhead', 'assumption.pension_on_base_salary']
      : ['assumption.firm_pays_overhead', 'assumption.pension_on_base_salary'],
    details: { salary: emp.salary, holidayPay: emp.holidayPay, gross: emp.gross },
  });
}

export const revenueShareScenario: ScenarioDefinition<RevenueShareOptions> = {
  id: 'revenue-share',
  labelKey: 'scenario.revenue-share.label',
  descriptionKey: 'scenario.revenue-share.description',
  inputSchema: revenueShareSchema,
  defaults: () => revenueShareSchema.parse({}),
  calculate: calculateRevenueShare,
};
