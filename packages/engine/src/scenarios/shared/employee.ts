import type { RuleSet } from '@lyvan/rules';
import type { ResolvedPerson } from '../../common';
import { roundKr } from '../../core/money';
import { solveIncreasing } from '../../core/solver';
import { employerFees } from '../../tax/employerFees';
import { holidayPay, type HolidayModel } from '../../tax/holiday';
import { incomeTax, type IncomeTaxResult } from '../../tax/personalIncomeTax';
import { loneVaxlingPremium, pensionCost, type PensionModel } from '../../tax/pension';
import type { Waterfall } from '../../core/waterfall';
import { fmtKr, fmtPct } from '../../core/format';
import type { Warning } from '../../types';
import { addIncomeTaxLines } from './lines';

export interface EmployeeParams {
  /** Money available for the person incl. all employer costs (annual). */
  budget: number;
  holiday: HolidayModel;
  pension: PensionModel;
  /** Salary exchange amount (gross salary given up for extra pension). */
  loneVaxling: number;
  person: ResolvedPerson;
  taxYear: number;
  rules: RuleSet;
}

export interface EmployeeResult {
  /** Paid base salary (whole kr). */
  salary: number;
  holidayPay: number;
  /** salary + holiday pay = earned income. */
  gross: number;
  employerFees: number;
  /** Pension premium incl. salary-exchange premium. */
  premium: number;
  slp: number;
  totalCost: number;
  tax: IncomeTaxResult;
  /** true when the budget could not even cover the fixed costs at zero salary. */
  budgetTooLow: boolean;
}

function costAt(salary: number, p: EmployeeParams): number {
  const h = holidayPay(p.holiday, salary, p.rules);
  const gross = salary + h;
  const fees = employerFees(gross, p.person, p.taxYear, p.rules);
  const pc = pensionCost(p.pension, salary + p.loneVaxling, p.rules);
  const xp = loneVaxlingPremium(p.loneVaxling, p.rules);
  const premium = pc.premium + xp;
  const slpAmt = pc.slp + xp * p.rules.slp;
  return gross + fees + premium + slpAmt;
}

/** Solve the paid salary so that total employer cost equals the budget. */
export function solveEmployee(p: EmployeeParams): EmployeeResult {
  const budget = Math.max(0, p.budget);
  const res = solveIncreasing((s) => costAt(s, p), budget, 0, Math.max(1, budget), 0.01);
  const salary = res.status === 'below' ? 0 : roundKr(res.x);
  const h = roundKr(holidayPay(p.holiday, salary, p.rules));
  const gross = salary + h;
  const fees = roundKr(employerFees(gross, p.person, p.taxYear, p.rules));
  const pc = pensionCost(p.pension, salary + p.loneVaxling, p.rules);
  const xp = loneVaxlingPremium(p.loneVaxling, p.rules);
  const premium = roundKr(pc.premium + xp);
  const slpAmt = roundKr(pc.slp + xp * p.rules.slp);
  const tax = incomeTax(gross, p.person, p.rules);
  return {
    salary,
    holidayPay: h,
    gross,
    employerFees: fees,
    premium,
    slp: slpAmt,
    totalCost: gross + fees + premium + slpAmt,
    tax,
    budgetTooLow: res.status === 'below',
  };
}

/**
 * Append the employee waterfall: employer fees, pension, SLP, gross subtotal, personal tax,
 * net cash. Caller is responsible for lines BEFORE these (firm cut, overhead, provider fee).
 */
export function addEmployeeLines(wf: Waterfall, e: EmployeeResult, p: EmployeeParams): void {
  wf.add('employer_fees', e.employerFees, 'state', 'tax', {
    formula: `${fmtPct(p.rules.employerFees.standard)} × ${fmtKr(e.gross)} (salary + holiday pay)`,
  });
  wf.add('pension_premium', e.premium, 'pension', 'pension', {
    hideIfZero: true,
    formula: `Occupational pension premium (${p.pension.kind}${p.loneVaxling > 0 ? ' + salary exchange' : ''})`,
  });
  wf.add('special_payroll_tax', e.slp, 'state', 'tax', {
    hideIfZero: true,
    formula: `${fmtPct(p.rules.slp)} × pension premium`,
  });
  wf.subtotal(
    'gross_salary',
    e.gross,
    'consultant',
    e.holidayPay > 0
      ? `${fmtKr(e.salary)} salary + ${fmtKr(e.holidayPay)} holiday pay`
      : `${fmtKr(e.salary)} salary`,
  );
  addIncomeTaxLines(wf, e.tax, p.person, p.rules);
  wf.add('net_cash', e.gross - e.tax.netTax, 'consultant', 'payout', {
    formula: `${fmtKr(e.gross)} gross − ${fmtKr(e.tax.netTax)} personal tax`,
  });
}

export function employeeWarnings(e: EmployeeResult, p: EmployeeParams, brytpunktIncome: number): Warning[] {
  const w: Warning[] = [];
  if (e.budgetTooLow) w.push({ code: 'BUDGET_TOO_LOW', severity: 'error' });
  if (e.gross > brytpunktIncome) {
    w.push({
      code: 'ABOVE_BRYTPUNKT',
      severity: 'info',
      params: { income: e.gross, brytpunkt: brytpunktIncome },
    });
  }
  if (e.gross < p.rules.sgiCapPbb * p.rules.pbb) {
    w.push({
      code: 'SALARY_BELOW_SGI_CAP',
      severity: 'info',
      params: { income: e.gross, cap: p.rules.sgiCapPbb * p.rules.pbb },
    });
  }
  return w;
}
