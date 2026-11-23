/**
 * Versioned tax-year rule sets. Pure data + types. No logic.
 * Every value in a RuleSet file must carry a `// source:` comment, and the RuleSet carries a
 * `verified` flag that the UI uses to show a "rules not verified" banner.
 */

/** Piecewise-linear tier: for x >= fromPbb * PBB the value is (basePbb + slope * (x/PBB - fromPbb)) * PBB. */
export interface PbbTier {
  fromPbb: number;
  basePbb: number;
  slope: number;
}

export interface RuleSet {
  id: string;
  country: 'SE';
  year: number;
  /** false until every value has been checked against Skatteverket. */
  verified: boolean;
  /** Where the values come from / must be checked. */
  sources: string[];
  /** Keys of values that are still NOT verified against an official source (shown in the UI). */
  unverifiedItems: string[];
  /** Age at the start of the year from which the 66+ rules (higher grundavdrag, separate JSA) apply. */
  seniorAge: number;

  /** Prisbasbelopp (SEK). */
  pbb: number;
  /** Inkomstbasbelopp for the tax year (SEK). */
  ibb: number;
  /** Inkomstbasbelopp for the previous year (SEK) - used for 3:12 grundbelopp. */
  ibbPrevYear: number;

  employerFees: {
    standard: number;
    /** Only ålderspensionsavgift; applies when the age at the START of the year is >= minAge. */
    reduced: { rate: number; minAge: number };
    youth: {
      /** Reduced rate on salary up to capMonthly, for ages minAge..maxAge AT THE START of the year. */
      rate: number;
      minAge: number;
      maxAge: number;
      capMonthly: number;
      /** Number of months in the tax year the reduction applies. */
      monthsInEffect: number;
    };
  };

  egenavgifter: {
    standard: number;
    reductionRate: number;
    reductionMax: number;
    /** Reduction base cap (surplus up to this amount). */
    reductionBaseCap: number;
  };

  /** Särskild löneskatt på pensionskostnader. */
  slp: number;
  corporateTax: number;

  municipalTaxAverage: number;
  burialFeeAverage: number;
  defaultChurchFeeRate: number;

  stateTax: {
    rate: number;
    /** Skiktgräns, measured on TAXABLE income (after grundavdrag). */
    skiktgrans: number;
  };

  grundavdrag: { tiers: PbbTier[] };

  /**
   * Förhöjt grundavdrag for persons who have turned `seniorAge` at the start of the year. It is
   * ADDED to the ordinary grundavdrag; the sum is rounded up to whole 100 kr.
   */
  grundavdragSenior: { tiers: PbbTier[] };

  /** Jobbskatteavdrag tiers on arbetsinkomst. Result = (base - grundavdrag) * municipalTaxRate. */
  jsa: { tiers: PbbTier[] };

  /**
   * Skattereduktion för arbetsinkomst for persons who have turned `seniorAge` at the start of the
   * year. Unlike `jsa` the tiers give the reduction itself (no grundavdrag, no municipal rate).
   */
  jsaSenior: { tiers: PbbTier[] };

  /**
   * Skattereduktion för förvärvsinkomst (SKV 433 §7.5.4): rate * (taxable income - base), at most
   * `max`, credited against municipal tax only (after jobbskatteavdrag).
   */
  earnedIncomeCredit: { rate: number; base: number; max: number };

  publicPensionFee: { rate: number; incomeCapIbb: number };
  /** Public service-avgift: rate * taxable income, at most rate * maxIbbMultiple * IBB. */
  publicServiceFee: { rate: number; maxIbbMultiple: number };

  itp1: { lowRate: number; highRate: number; thresholdIbb: number };

  semester: {
    days: number;
    /** Legal minimum supplement per vacation day, share of monthly salary. */
    supplementPerDayLegal: number;
    /** Common collective-agreement supplement per vacation day. */
    supplementPerDayAgreement: number;
    /** Semesterersättning for hourly/umbrella/pot models, share of salary. */
    compensationPct: number;
  };

  threeTwelve: {
    dividendTaxRate: number;
    /** Grundbelopp = multiple * ibbPrevYear, per company, split by ownership. */
    grundbeloppIbbMultiple: number;
    wageBasedRate: number;
    wageDeductionIbbMultiple: number;
    /** Excess dividend taxed as employment income up to this many IBB, above it as capital. */
    excessEmploymentCapIbb: number;
    capitalTaxRate: number;
  };

  /** Periodiseringsfond (sole trader): maximum share of the income that may be allocated. */
  periodiseringsfond: { maxPct: number };

  /** Salary-exchange uplift (employer passes on part of saved fees). */
  loneVaxlingUplift: number;

  /** SGI ceiling in PBB (10). */
  sgiCapPbb: number;
  /** Pensionable income ceiling in IBB (7.5). */
  pgiCapIbb: number;
}
