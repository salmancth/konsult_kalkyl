import type { RuleSet } from '@lyvan/rules';

export interface GransbeloppInput {
  /** Company cash wages (annual, SEK) used for the wage-based space. */
  cashWages: number;
  /** Owner share of the company, 0..1. */
  ownershipPct: number;
  /** Saved dividend space (sparat utdelningsutrymme) carried in. */
  saved: number;
}

export interface Gransbelopp {
  grundbelopp: number;
  wageBased: number;
  saved: number;
  total: number;
}

/**
 * Gränsbelopp under the 2026 3:12 reform (one common model, per company, split by ownership):
 * grundbelopp + wage-based space (50 % of wages above 8 IBB) + saved space.
 * Simplification: no interest on omkostnadsbelopp and no 50x-own-salary cap.
 */
export function gransbelopp(input: GransbeloppInput, rules: RuleSet): Gransbelopp {
  const t = rules.threeTwelve;
  const own = Math.min(1, Math.max(0, input.ownershipPct));
  const grundbelopp = t.grundbeloppIbbMultiple * rules.ibbPrevYear * own;
  const wageBased =
    t.wageBasedRate * Math.max(0, input.cashWages - t.wageDeductionIbbMultiple * rules.ibbPrevYear) * own;
  const saved = Math.max(0, input.saved);
  return { grundbelopp, wageBased, saved, total: grundbelopp + wageBased + saved };
}

export interface DividendSplit {
  /** Part of the dividend taxed at the 20 % rate. */
  withinGransbelopp: number;
  /** Part exceeding the gränsbelopp (taxed as employment income / capital). */
  excess: number;
  /** 20 % tax on the part within the gränsbelopp. */
  taxWithin: number;
}

export function splitDividend(dividend: number, gransbeloppTotal: number, rules: RuleSet): DividendSplit {
  const div = Math.max(0, dividend);
  const within = Math.min(div, Math.max(0, gransbeloppTotal));
  return {
    withinGransbelopp: within,
    excess: div - within,
    taxWithin: within * rules.threeTwelve.dividendTaxRate,
  };
}
