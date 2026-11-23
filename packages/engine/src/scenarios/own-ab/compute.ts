import type { RuleSet } from '@lyvan/rules';
import type { ResolvedCommon } from '../../common';
import { fmtKr, fmtPct } from '../../core/format';
import { roundKr } from '../../core/money';
import { solveIncreasing } from '../../core/solver';
import { Waterfall } from '../../core/waterfall';
import { corporateTax } from '../../tax/corporateTax';
import { employerFees } from '../../tax/employerFees';
import { pensionCost } from '../../tax/pension';
import { incomeTax, type IncomeTaxResult } from '../../tax/personalIncomeTax';
import { gransbelopp, splitDividend, type DividendSplit } from '../../tax/threeTwelve';
import type { ScenarioResult, Warning } from '../../types';
import { addIncomeTaxLines } from '../shared/lines';
import { makeResult } from '../shared/result';
import type { OwnAbOptions } from './schema';

/** Company cost of paying `salary`: salary + employer fees + pension premium + SLP. */
function salaryCost(salary: number, common: ResolvedCommon, opts: OwnAbOptions, rules: RuleSet): number {
  const fees = employerFees(salary, common.person, common.taxYear, rules);
  const pc = pensionCost(opts.pensionModel, salary, rules);
  return salary + fees + pc.premium + pc.slp;
}

/** Highest salary the AB can afford without a loss (profit before tax >= 0). */
export function maxAffordableSalary(common: ResolvedCommon, opts: OwnAbOptions, rules: RuleSet): number {
  const available = common.revenue * (1 - opts.brokerFeePct) - common.overhead;
  if (available <= 0) return 0;
  const res = solveIncreasing((s) => salaryCost(s, common, opts, rules), available, 0, available, 0.01);
  return res.status === 'below' ? 0 : res.x;
}

/** All numbers of the own-AB calculation for one salary (no waterfall, cheap to evaluate). */
export interface OwnAbCore {
  revenue: number;
  salary: number;
  broker: number;
  overhead: number;
  fees: number;
  premium: number;
  slp: number;
  profit: number;
  corpTax: number;
  distributable: number;
  gransbelopp: number;
  dividend: number;
  retained: number;
  split: DividendSplit;
  dividendTax: number;
  excess: number;
  excessTax: number;
  salaryTax: IncomeTaxResult;
  netSalary: number;
  netDividend: number;
}

/** Pure number crunching for the own-AB scenario at a given salary. */
export function computeOwnAb(
  common: ResolvedCommon,
  opts: OwnAbOptions,
  rules: RuleSet,
  salaryInput: number,
): OwnAbCore {
  const R = roundKr(common.revenue);
  const salary = roundKr(salaryInput);
  const broker = roundKr(common.revenue * opts.brokerFeePct);
  const overhead = roundKr(common.overhead);

  const fees = roundKr(employerFees(salary, common.person, common.taxYear, rules));
  const pc = pensionCost(opts.pensionModel, salary, rules);
  const premium = roundKr(pc.premium);
  const slp = roundKr(pc.slp);

  const profit = R - broker - overhead - salary - fees - premium - slp;
  const corpTax = roundKr(corporateTax(profit, rules));
  const distributable = profit - corpTax;

  const g = gransbelopp(
    { cashWages: salary, ownershipPct: opts.ownershipPct, saved: opts.savedDividendSpace },
    rules,
  );
  const gTotal = roundKr(g.total);
  const wantedDividend = Math.max(0, distributable);
  const dividend = opts.capDividendAtGransbelopp ? Math.min(wantedDividend, gTotal) : wantedDividend;
  const retained = distributable - dividend;

  const split = splitDividend(dividend, gTotal, rules);
  const dividendTax = roundKr(split.taxWithin);
  // Excess over gränsbelopp: employment income up to a cap, then capital income.
  const excess = split.excess;
  const empCap = rules.threeTwelve.excessEmploymentCapIbb * rules.ibb;
  const excessEmp = Math.min(excess, empCap);
  const excessCap = excess - excessEmp;
  const salaryTax = incomeTax(salary, common.person, rules);
  const excessTax =
    excess > 0
      ? roundKr(
          incomeTax(salary + excessEmp, common.person, rules).netTax -
            salaryTax.netTax +
            excessCap * rules.threeTwelve.capitalTaxRate,
        )
      : 0;
  return {
    revenue: R,
    salary,
    broker,
    overhead,
    fees,
    premium,
    slp,
    profit,
    corpTax,
    distributable,
    gransbelopp: gTotal,
    dividend,
    retained,
    split,
    dividendTax,
    excess,
    excessTax,
    salaryTax,
    netSalary: salary - salaryTax.netTax,
    netDividend: dividend - dividendTax - excessTax,
  };
}

/** Full own-AB calculation (with waterfall, warnings and totals) for a given salary. */
export function buildOwnAb(
  common: ResolvedCommon,
  opts: OwnAbOptions,
  rules: RuleSet,
  salaryInput: number,
  extraWarnings: Warning[] = [],
): ScenarioResult {
  const c = computeOwnAb(common, opts, rules, salaryInput);

  const wf = new Waterfall(c.revenue, 'retained_in_ab');
  wf.add('broker_fee', c.broker, 'company', 'fee', {
    hideIfZero: true,
    formula: `${fmtPct(opts.brokerFeePct)} × ${fmtKr(c.revenue)} (LYVAN broker fee)`,
  });
  wf.add('overhead', c.overhead, 'external', 'cost', {
    hideIfZero: true,
    formula: 'Accounting, IT, insurance, wellness',
  });
  wf.subtotal('gross_salary', c.salary, 'consultant', `${fmtKr(c.salary)} salary`);
  wf.add('employer_fees', c.fees, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(rules.employerFees.standard)} × ${fmtKr(c.salary)}`,
  });
  wf.add('pension_premium', c.premium, 'pension', 'pension', {
    hideIfZero: true,
    formula: `Occupational pension premium (${opts.pensionModel.kind})`,
  });
  wf.add('special_payroll_tax', c.slp, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(rules.slp)} × pension premium`,
  });
  wf.subtotal('profit_before_tax', c.profit, 'company', `${fmtKr(c.revenue)} − fee − overhead − salary − fees − pension`);
  wf.add('corporate_tax', c.corpTax, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(rules.corporateTax, 1)} × ${fmtKr(Math.max(0, c.profit))}`,
  });
  wf.add('retained_in_ab', c.retained, 'consultant', 'retained', {
    formula: opts.capDividendAtGransbelopp
      ? `Profit after tax ${fmtKr(c.distributable)} − dividend ${fmtKr(c.dividend)} (capped at gränsbelopp ${fmtKr(c.gransbelopp)})`
      : 'Profit after tax not paid out',
  });
  wf.subtotal('dividend_gross', c.dividend, 'consultant', `Dividend ${fmtKr(c.dividend)} (gränsbelopp ${fmtKr(c.gransbelopp)})`);
  addIncomeTaxLines(wf, c.salaryTax, common.person, rules);
  wf.add('net_salary', c.netSalary, 'consultant', 'payout', {
    hideIfZero: true,
    formula: `${fmtKr(c.salary)} salary − ${fmtKr(c.salaryTax.netTax)} personal tax`,
  });
  wf.add('dividend_tax', c.dividendTax, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(rules.threeTwelve.dividendTaxRate)} × ${fmtKr(c.split.withinGransbelopp)} (within gränsbelopp)`,
  });
  wf.add('dividend_excess_tax', c.excessTax, 'state', 'tax', {
    hideIfZero: true,
    formula: `Excess dividend ${fmtKr(c.excess)} taxed as employment income (marginal)`,
  });
  wf.add('net_dividend', c.netDividend, 'consultant', 'payout', {
    hideIfZero: true,
    formula: `${fmtKr(c.dividend)} dividend − ${fmtKr(c.dividendTax + c.excessTax)} tax`,
  });

  const warnings: Warning[] = [...extraWarnings];
  if (c.profit < 0) warnings.push({ code: 'NEGATIVE_PROFIT', severity: 'error' });
  if (c.excess > 0) {
    warnings.push({
      code: 'DIVIDEND_EXCEEDS_GRANSBELOPP',
      severity: 'warning',
      params: { excess: c.excess, gransbelopp: c.gransbelopp },
    });
  }
  if (c.retained > 0) warnings.push({ code: 'RETAINED_IN_AB', severity: 'info', params: { retained: c.retained } });
  if (c.salary < rules.sgiCapPbb * rules.pbb) {
    warnings.push({
      code: 'SALARY_BELOW_SGI_CAP',
      severity: 'info',
      params: { income: c.salary, cap: rules.sgiCapPbb * rules.pbb },
    });
  }
  if (c.salary < rules.pgiCapIbb * rules.ibb) {
    warnings.push({
      code: 'SALARY_BELOW_PGI_CAP',
      severity: 'info',
      params: { income: c.salary, cap: rules.pgiCapIbb * rules.ibb },
    });
  }
  if (opts.ownershipPct < 1 || opts.ownersInCompany > 1) {
    warnings.push({ code: 'PARTNER_SHARES_GRUNDBELOPP', severity: 'info' });
  }
  warnings.push({ code: 'DIVIDEND_PAID_NEXT_YEAR', severity: 'info' });

  return makeResult({
    scenarioId: 'own-ab',
    common,
    rules,
    wf,
    grossPayout: c.salary + c.dividend,
    warnings,
    assumptions: [
      'assumption.steady_state_dividend',
      'assumption.gransbelopp_simplified',
      'assumption.owner_no_holiday_pay',
    ],
    details: {
      salary: c.salary,
      profitBeforeTax: c.profit,
      gransbelopp: c.gransbelopp,
      dividend: c.dividend,
      retained: c.retained,
      excessDividend: c.excess,
    },
  });
}
