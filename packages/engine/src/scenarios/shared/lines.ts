import type { RuleSet } from '@lyvan/rules';
import type { ResolvedPerson } from '../../common';
import type { IncomeTaxResult } from '../../tax/personalIncomeTax';
import { fmtKr, fmtPct } from '../../core/format';
import { NON_ALLOCATION_KINDS, type Line, type Totals } from '../../types';
import type { Waterfall } from '../../core/waterfall';

/** Add the personal income tax components as state lines (jobbskatteavdrag is negative). */
export function addIncomeTaxLines(
  wf: Waterfall,
  tax: IncomeTaxResult,
  person: ResolvedPerson,
  rules: RuleSet,
  keyPrefix = '',
): void {
  const k = (s: string): string => `${keyPrefix}${s}`;
  wf.add(k('municipal_tax'), tax.municipalTax, 'state', 'tax', {
    formula: `${fmtPct(person.municipalTaxRate)} × ${fmtKr(tax.taxableIncome)} (taxable income)`,
  });
  wf.add(k('state_tax'), tax.stateTax, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(rules.stateTax.rate)} × (${fmtKr(tax.taxableIncome)} − ${fmtKr(rules.stateTax.skiktgrans)})`,
  });
  wf.add(k('burial_fee'), tax.burialFee, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(person.burialFeeRate, 3)} × ${fmtKr(tax.taxableIncome)}`,
  });
  wf.add(k('church_fee'), tax.churchFee, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(person.churchFeeRate)} × ${fmtKr(tax.taxableIncome)}`,
  });
  wf.add(k('public_service_fee'), tax.publicServiceFee, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(rules.publicServiceFee.rate)} of taxable income, max ${fmtKr(rules.publicServiceFee.rate * rules.publicServiceFee.maxIbbMultiple * rules.ibb)}`,
  });
  wf.add(k('jobbskatteavdrag'), -tax.jobbskatteavdrag, 'state', 'tax', {
    hideIfZero: true,
    formula: `Jobbskatteavdrag (tax credit) on earned income ${fmtKr(tax.earnedIncome)}`,
  });
  wf.add(k('earned_income_credit'), -tax.earnedIncomeCredit, 'state', 'tax', {
    hideIfZero: true,
    formula: `Skattereduktion för förvärvsinkomst: ${fmtPct(rules.earnedIncomeCredit.rate)} × (${fmtKr(tax.taxableIncome)} − ${fmtKr(rules.earnedIncomeCredit.base)}), max ${fmtKr(rules.earnedIncomeCredit.max)}`,
  });
}

/** Derive KPI totals from the final waterfall lines. */
export function deriveTotals(lines: Line[], revenue: number, grossPayout: number): Totals {
  const alloc = lines.filter((l) => !NON_ALLOCATION_KINDS.has(l.kind));
  const sum = (pred: (l: Line) => boolean): number =>
    alloc.filter(pred).reduce((s, l) => s + l.amount, 0);

  const netCash = sum((l) => l.kind === 'payout');
  const pensionValue = sum((l) => l.kind === 'pension');
  const totalToState = sum((l) => l.party === 'state');
  const companyRetained = sum((l) => l.party === 'company');
  const providerFee = sum((l) => l.party === 'provider');
  const retainedForConsultant = sum((l) => l.kind === 'retained' && l.party === 'consultant');
  const overhead = sum((l) => l.party === 'external');
  const base = revenue - overhead - companyRetained - providerFee;
  return {
    revenue,
    grossPayout,
    netCash,
    pensionValue,
    consultantValue: netCash + pensionValue,
    totalToState,
    companyRetained,
    providerFee,
    retainedForConsultant,
    overhead,
    effectiveTaxRate: base > 0 ? totalToState / base : 0,
    netPctOfRevenue: revenue > 0 ? netCash / revenue : 0,
  };
}
