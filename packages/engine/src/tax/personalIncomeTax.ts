import type { PbbTier, RuleSet } from '@lyvan/rules';
import type { ResolvedPerson } from '../common';
import { ageAtYearStart, ceilTo100, floorKr, floorTo100, roundKr, roundTo100HalfDown } from '../core/money';
import { solveIncreasing } from '../core/solver';

/** Evaluate a PBB-tiered piecewise-linear function at x (SEK). Result in SEK. */
export function evalTiers(tiers: PbbTier[], x: number, pbb: number): number {
  let active: PbbTier | undefined;
  for (const t of tiers) {
    if (x >= t.fromPbb * pbb) active = t;
  }
  if (!active) return 0;
  return (active.basePbb + active.slope * (x / pbb - active.fromPbb)) * pbb;
}

/** True when the person has turned `rules.seniorAge` at the start of the rule set's year. */
export function isSenior(person: Pick<ResolvedPerson, 'birthYear'>, rules: RuleSet): boolean {
  return ageAtYearStart(person.birthYear, rules.year) >= rules.seniorAge;
}

/**
 * Grundavdrag: the ordinary one plus, for persons who have turned 66, the förhöjt grundavdrag
 * (summed BEFORE rounding), rounded up to whole 100 kr, never above the income itself.
 */
export function grundavdrag(earnedIncome: number, rules: RuleSet, senior = false): number {
  if (earnedIncome <= 0) return 0;
  const ordinary = evalTiers(rules.grundavdrag.tiers, earnedIncome, rules.pbb);
  const raised = senior ? evalTiers(rules.grundavdragSenior.tiers, earnedIncome, rules.pbb) : 0;
  return Math.min(earnedIncome, ceilTo100(ordinary + raised));
}

/**
 * Jobbskatteavdrag (skattereduktion för arbetsinkomst, SKV 433 §7.5.2) on arbetsinkomst, credited
 * against the municipal tax only. The work income is floored to whole 100 kr and the result to
 * whole kronor, as in Skatteverket's technical description. `senior` selects the 66+ formula.
 */
export function jobbskatteavdrag(
  workIncome: number,
  grundavdragAmount: number,
  municipalTaxRate: number,
  municipalTax: number,
  rules: RuleSet,
  senior = false,
): number {
  if (workIncome <= 0) return 0;
  if (senior) {
    // 66+: the tiers give the reduction itself (no grundavdrag, no municipal rate).
    const amount = evalTiers(rules.jsaSenior.tiers, floorTo100(workIncome), rules.pbb);
    return floorKr(Math.min(amount, municipalTax));
  }
  const base = evalTiers(rules.jsa.tiers, floorTo100(workIncome), rules.pbb);
  const raw = Math.max(0, base - grundavdragAmount) * municipalTaxRate;
  return floorKr(Math.min(raw, municipalTax));
}

/**
 * Skattereduktion för förvärvsinkomst (SKV 433 §7.5.4): 0.75 % of (taxable income - 40 000), at
 * most 1 500 kr. Credited against municipal tax only, after jobbskatteavdrag.
 */
export function earnedIncomeCredit(
  taxableIncome: number,
  municipalTaxLeft: number,
  rules: RuleSet,
): number {
  const c = rules.earnedIncomeCredit;
  const raw = Math.min(c.max, Math.max(0, c.rate * (taxableIncome - c.base)));
  return floorKr(Math.min(raw, Math.max(0, municipalTaxLeft)));
}

/** Public service-avgift: 1 % of taxable income, capped at 1 % x 1.42 IBB (1 184 kr in 2026). */
export function publicServiceFee(taxableIncome: number, rules: RuleSet): number {
  if (taxableIncome <= 0) return 0;
  const cap = rules.publicServiceFee.rate * rules.publicServiceFee.maxIbbMultiple * rules.ibb;
  return floorKr(Math.min(rules.publicServiceFee.rate * taxableIncome, cap));
}

export interface IncomeTaxResult {
  earnedIncome: number;
  grundavdrag: number;
  taxableIncome: number;
  municipalTax: number;
  burialFee: number;
  churchFee: number;
  stateTax: number;
  publicServiceFee: number;
  jobbskatteavdrag: number;
  /** Skattereduktion för förvärvsinkomst (max 1 500 kr). */
  earnedIncomeCredit: number;
  /** Informational: allmän pensionsavgift, fully offset by an equal tax reduction (net 0). */
  publicPensionFee: number;
  /** municipal + state + burial + church + public service - jobbskatteavdrag - förvärvsinkomst credit. */
  netTax: number;
  /** earnedIncome - netTax. */
  netIncome: number;
}

/**
 * Personal income tax for earned income (salary + holiday pay, or sole-trader surplus after
 * egenavgifter). Persons who have turned 66 at the start of the year get the förhöjt grundavdrag
 * and the higher skattereduktion för arbetsinkomst.
 */
export function incomeTax(
  earnedIncome: number,
  person: ResolvedPerson,
  rules: RuleSet,
): IncomeTaxResult {
  const fi = Math.max(0, earnedIncome);
  const senior = isSenior(person, rules);
  const ga = grundavdrag(fi, rules, senior);
  const ti = floorTo100(Math.max(0, fi - ga));
  const municipalTax = ti * person.municipalTaxRate;
  const burialFee = ti * person.burialFeeRate;
  const churchFee = person.churchMember ? ti * person.churchFeeRate : 0;
  const stateTax = rules.stateTax.rate * Math.max(0, ti - rules.stateTax.skiktgrans);
  const psf = publicServiceFee(ti, rules);
  const jsa = jobbskatteavdrag(fi, ga, person.municipalTaxRate, municipalTax, rules, senior);
  const credit = earnedIncomeCredit(ti, municipalTax - jsa, rules);
  const publicPensionFee = roundTo100HalfDown(
    rules.publicPensionFee.rate * Math.min(fi, rules.publicPensionFee.incomeCapIbb * rules.ibb),
  );

  const r = {
    municipalTax: roundKr(municipalTax),
    burialFee: roundKr(burialFee),
    churchFee: roundKr(churchFee),
    stateTax: roundKr(stateTax),
    publicServiceFee: psf,
    jobbskatteavdrag: jsa,
    earnedIncomeCredit: credit,
  };
  const netTax =
    r.municipalTax +
    r.burialFee +
    r.churchFee +
    r.stateTax +
    r.publicServiceFee -
    r.jobbskatteavdrag -
    r.earnedIncomeCredit;
  return {
    earnedIncome: roundKr(fi),
    grundavdrag: ga,
    taxableIncome: ti,
    ...r,
    publicPensionFee,
    netTax,
    netIncome: roundKr(fi) - netTax,
  };
}

/** Marginal tax rate on the next 100 kr of earned income (finite difference). */
export function marginalTaxRate(
  earnedIncome: number,
  person: ResolvedPerson,
  rules: RuleSet,
): number {
  const a = incomeTax(earnedIncome, person, rules).netTax;
  const b = incomeTax(earnedIncome + 100, person, rules).netTax;
  return (b - a) / 100;
}

/**
 * Brytpunkt: smallest earned income at which state tax starts, derived by solving
 * taxableIncome(FI) >= skiktgrans (NOT a constant: skiktgräns applies to taxable income).
 */
export function brytpunkt(rules: RuleSet, senior = false): number {
  const taxable = (fi: number): number => floorTo100(Math.max(0, fi - grundavdrag(fi, rules, senior)));
  const res = solveIncreasing(taxable, rules.stateTax.skiktgrans, 0, 10_000_000, 0.01);
  // Bisection upper bound lands within 0.01 kr above the exact threshold; round up to whole kr.
  return Math.ceil(res.x - 0.02);
}
