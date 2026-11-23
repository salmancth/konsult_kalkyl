import type { RuleSet } from '@lyvan/rules';
import type { ResolvedCommon, ResolvedPerson } from '../../common';
import type { Waterfall } from '../../core/waterfall';
import { ageAtYearStart } from '../../core/money';
import { brytpunkt, isSenior } from '../../tax/personalIncomeTax';
import type { ScenarioId, ScenarioResult, Warning } from '../../types';
import { deriveTotals } from './lines';

export const ENGINE_VERSION = '2.0.0';

const brytpunktCache = new WeakMap<RuleSet, { standard?: number; senior?: number }>();

/**
 * Memoised derived brytpunkt (gross income where state tax starts). Persons who have turned 66
 * have a higher grundavdrag and therefore a higher brytpunkt.
 */
export function getBrytpunkt(rules: RuleSet, person?: Pick<ResolvedPerson, 'birthYear'>): number {
  const senior = person ? isSenior(person, rules) : false;
  const entry = brytpunktCache.get(rules) ?? {};
  brytpunktCache.set(rules, entry);
  const key = senior ? 'senior' : 'standard';
  const cached = entry[key];
  if (cached !== undefined) return cached;
  const v = brytpunkt(rules, senior);
  entry[key] = v;
  return v;
}

export function commonWarnings(common: ResolvedCommon, rules: RuleSet): Warning[] {
  const w: Warning[] = [];
  const age = ageAtYearStart(common.person.birthYear, common.taxYear);
  if (age >= rules.seniorAge) {
    // The 66+ tax rules are applied; pension plans and egenavgifter for the elderly are not modelled.
    w.push({ code: 'AGE_66_PLUS', severity: 'info', params: { age } });
  }
  if (common.taxYear !== rules.year) {
    w.push({
      code: 'TAX_YEAR_MISMATCH',
      severity: 'warning',
      params: { taxYear: common.taxYear, rulesYear: rules.year },
    });
  }
  return w;
}

export interface MakeResultArgs {
  scenarioId: ScenarioId;
  common: ResolvedCommon;
  rules: RuleSet;
  wf: Waterfall;
  grossPayout: number;
  warnings: Warning[];
  assumptions: string[];
  details?: Record<string, number | string>;
}

export function makeResult(a: MakeResultArgs): ScenarioResult {
  const { lines, balanceAdjustment } = a.wf.finish();
  return {
    scenarioId: a.scenarioId,
    lines,
    totals: deriveTotals(lines, Math.round(a.common.revenue), a.grossPayout),
    warnings: [...commonWarnings(a.common, a.rules), ...a.warnings],
    assumptions: a.assumptions,
    meta: {
      ruleSetId: a.rules.id,
      ruleSetVerified: a.rules.verified,
      engineVersion: ENGINE_VERSION,
      balanceAdjustment,
      details: a.details ?? {},
    },
  };
}
