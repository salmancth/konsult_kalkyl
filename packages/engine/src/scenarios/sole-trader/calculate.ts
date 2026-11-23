import type { RuleSet } from '@lyvan/rules';
import type { ResolvedCommon } from '../../common';
import { fmtKr, fmtPct } from '../../core/format';
import { ageAtYearStart, roundKr } from '../../core/money';
import { Waterfall } from '../../core/waterfall';
import { egenavgifter } from '../../tax/egenavgifter';
import { incomeTax } from '../../tax/personalIncomeTax';
import type { ScenarioResult, Warning } from '../../types';
import { addIncomeTaxLines } from '../shared/lines';
import { makeResult } from '../shared/result';
import type { ScenarioDefinition } from '../types';
import { soleTraderSchema, type SoleTraderOptions } from './schema';

/**
 * Sole trader (enskild firma).
 *
 * 1. surplus S = revenue - overhead
 * 2. egenavgifter are solved as a fixed point on the WHOLE surplus (an allocation to a
 *    periodiseringsfond does not reduce the contribution base - see rules.unverifiedItems)
 * 3. income I = S - egenavgifter; the allocation is `pct` of I (capped by the rule set)
 * 4. personal income tax is paid on I - allocation
 */
export function calculateSoleTrader(
  common: ResolvedCommon,
  opts: SoleTraderOptions,
  rules: RuleSet,
): ScenarioResult {
  const surplus = roundKr(common.revenue - common.overhead);
  const ea = egenavgifter(surplus, rules);
  const eaAmount = roundKr(ea.amount);
  const incomeAfterEa = surplus - eaAmount;

  const maxPct = rules.periodiseringsfond.maxPct;
  const fundPct = Math.min(opts.periodiseringsfondPct, maxPct);
  const allocation = surplus > 0 ? roundKr(Math.max(0, incomeAfterEa) * fundPct) : 0;
  const taxableIncome = incomeAfterEa - allocation;
  const tax = incomeTax(taxableIncome, common.person, rules);

  const wf = new Waterfall(common.revenue, 'net_cash');
  wf.add('overhead', common.overhead, 'external', 'cost', {
    hideIfZero: true,
    formula: 'Direct business costs',
  });
  wf.subtotal(
    'taxable_surplus',
    surplus,
    'consultant',
    `${fmtKr(common.revenue)} − ${fmtKr(common.overhead)} overhead`,
  );
  wf.add('egenavgifter', eaAmount, 'state', 'tax', {
    formula: `${fmtPct(rules.egenavgifter.standard)} × ${fmtKr(ea.base)} − ${fmtKr(ea.reduction)} nedsättning (contributions are deductible from their own base)`,
  });
  wf.add('periodiseringsfond', allocation, 'consultant', 'retained', {
    hideIfZero: true,
    formula: `${fmtPct(fundPct)} × ${fmtKr(incomeAfterEa)} income after egenavgifter (deferred, taxed when reversed)`,
  });
  if (surplus > 0) addIncomeTaxLines(wf, tax, common.person, rules);
  wf.add('net_cash', surplus > 0 ? taxableIncome - tax.netTax : surplus, 'consultant', 'payout', {
    formula: `${fmtKr(taxableIncome)} taxable income − ${fmtKr(tax.netTax)} personal tax`,
  });

  const warnings: Warning[] = [];
  if (surplus <= 0) warnings.push({ code: 'NEGATIVE_PROFIT', severity: 'error' });
  if (opts.periodiseringsfondPct > maxPct) {
    warnings.push({ code: 'PERIODISERINGSFOND_CAPPED', severity: 'warning', params: { maxPct } });
  }
  if (allocation > 0) warnings.push({ code: 'PERIODISERINGSFOND_TAXED_LATER', severity: 'info' });
  warnings.push({ code: 'SOLE_TRADER_PERSONAL_LIABILITY', severity: 'info' });
  // Born 1958 or earlier pay only the age-pension part of the egenavgifter; not modelled.
  const age = ageAtYearStart(common.person.birthYear, common.taxYear);
  if (age >= rules.employerFees.reduced.minAge) {
    warnings.push({ code: 'EGENAVGIFTER_AGE_NOT_MODELLED', severity: 'warning', params: { age } });
  }

  return makeResult({
    scenarioId: 'sole-trader',
    common,
    rules,
    wf,
    grossPayout: surplus,
    warnings,
    assumptions: [
      'assumption.sole_trader_no_employer_pension',
      'assumption.egenavgifter_fixed_point',
      'assumption.sole_trader_profit_taxed_same_year',
      'assumption.egenavgifter_before_fund',
    ],
    details: { surplus, egenavgifter: eaAmount, earnedIncome: taxableIncome, allocation },
  });
}

export const soleTraderScenario: ScenarioDefinition<SoleTraderOptions> = {
  id: 'sole-trader',
  labelKey: 'scenario.sole-trader.label',
  descriptionKey: 'scenario.sole-trader.description',
  inputSchema: soleTraderSchema,
  defaults: () => soleTraderSchema.parse({}),
  calculate: calculateSoleTrader,
};
