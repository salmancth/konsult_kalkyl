import type { PbbTier, RuleSet } from '../types';

/** Tier for a + b x (income / PBB) starting at `fromPbb`, written the way SKV 433 prints it. */
const affine = (fromPbb: number, a: number, b: number): PbbTier => ({ fromPbb, basePbb: a + b * fromPbb, slope: b });

/**
 * Swedish rules for income year 2026.
 *
 * Verified against Skatteverket "SKV 433 Teknisk beskrivning skattetabeller 2026" (utgåva 36,
 * 2025-12-10) and skatteverket.se "Belopp och procent 2026": PBB, IBB, skiktgräns, grundavdrag,
 * jobbskatteavdrag (under 66), skattereduktion för förvärvsinkomst, public service-avgift,
 * allmän pensionsavgift, employer fees (standard / 67+ / youth), egenavgifter and the 3:12
 * grundbelopp.
 *
 * `verified` stays false until every item in `unverifiedItems` has been checked. The UI shows a
 * banner (with the list) while `verified === false`.
 */
export const SE_2026: RuleSet = {
  id: 'SE-2026',
  country: 'SE',
  year: 2026,
  verified: false,
  sources: [
    'Skatteverket SKV 433 Teknisk beskrivning skattetabeller 2026 (utgåva 36, 2025-12-10)',
    'skatteverket.se - Belopp och procent 2026',
    'Skatteverket - 3:12-reglerna fr.o.m. 2026 (gränsbelopp)',
  ],
  unverifiedItems: [
    'slp',
    'itp1',
    'semester.supplementPerDayAgreement',
    'threeTwelve.wageBasedRate',
    'threeTwelve.excessEmploymentCapIbb',
    'loneVaxlingUplift',
    'egenavgifterBeforePeriodiseringsfond',
  ],

  // Age (at the START of the year) from which the 66+ rules apply (forhojt grundavdrag, higher
  // skattereduktion for arbetsinkomst).
  seniorAge: 66,

  // source: SKV 433 2026 - prisbasbelopp 59 200
  pbb: 59_200,
  // source: SKV 433 2026 / Belopp och procent 2026 - inkomstbasbelopp 83 400
  ibb: 83_400,
  // source: inkomstbasbelopp 2025 = 80 600; the 3:12 rules use the IBB of the year BEFORE the
  // tax year (322 400 = 4 x 80 600 and 8 x 80 600 = 644 800 are confirmed by Skatteverket / Wolters Kluwer)
  ibbPrevYear: 80_600,

  employerFees: {
    // source: skatteverket.se arbetsgivaravgifter 2026 (born 1959 or later, full rate)
    standard: 0.3142,
    // source: skatteverket.se - born 1938-1958 (67+ at the start of the year) pay only
    // ålderspensionsavgift 10.21 %
    reduced: { rate: 0.1021, minAge: 67 },
    // source: temporary reduction 2026-04-01 -> 2027-09-30, born 2003-2007 (age 18-22 at the start
    // of 2026), 20.81 % on pay up to 25 000/month
    youth: { rate: 0.2081, minAge: 18, maxAge: 22, capMonthly: 25_000, monthsInEffect: 9 },
  },

  egenavgifter: {
    // source: skatteverket.se egenavgifter 2025-2026 (28.97 %)
    standard: 0.2897,
    // source: SFS 2023:754 - nedsättning 7.5 % of the base, max 15 000 kr per year
    reductionRate: 0.075,
    reductionMax: 15_000,
    reductionBaseCap: 200_000,
  },

  // VERIFY: särskild löneskatt på pensionskostnader 24.26 %
  slp: 0.2426,
  // source: bolagsskatt 20.6 %
  corporateTax: 0.206,

  // source: SCB OE0101 - national average total municipal tax 2026 = 32.38 % (per municipality: see
  // localities-2026.ts)
  municipalTaxAverage: 0.3238,
  // source: SCB OE0101 - national average begravningsavgift 2026 = 0.26 %
  burialFeeAverage: 0.0026,
  // source: SCB OE0101 - national average kyrkoavgift incl. begravningsavgift 2026 = 1.32 %, so the
  // church fee on its own (the burial fee is charged separately) is 1.06 %
  defaultChurchFeeRate: 0.0106,

  stateTax: {
    rate: 0.2,
    // source: SKV 433 2026 §7.2 - 20 % of taxable income above 643 000 (brytpunkt 660 400, < 66 years)
    skiktgrans: 643_000,
  },

  grundavdrag: {
    // source: SKV 433 2026 §6 - grundavdrag in PBB multiples (< 66 years)
    tiers: [
      { fromPbb: 0, basePbb: 0.423, slope: 0 },
      { fromPbb: 0.99, basePbb: 0.423, slope: 0.2 },
      { fromPbb: 2.72, basePbb: 0.77, slope: 0 },
      { fromPbb: 3.11, basePbb: 0.77, slope: -0.1 },
      { fromPbb: 7.88, basePbb: 0.293, slope: 0 },
    ],
  },

  grundavdragSenior: {
    // source: SKV 433 2026 §6.2 - förhöjt grundavdrag, 66 or older at the start of the year. Each tier
    // is printed there as a + b x FFI (in PBB units); the document's three worked examples are golden
    // tests. Added to the ordinary grundavdrag, the sum is rounded up to 100 kr.
    tiers: [
      { fromPbb: 0, basePbb: 0.687, slope: 0 },
      affine(0.91, 0.885, -0.2),
      affine(1.11, 0.6, 0.057),
      affine(1.965, 0.333, 0.1949),
      affine(2.72, -0.212, 0.3949),
      affine(3.11, -0.523, 0.4949),
      affine(3.24, -0.073, 0.356),
      affine(5, 0.017, 0.338),
      affine(7.88, 0.703, 0.251),
      { fromPbb: 8.08, basePbb: 2.732, slope: 0 },
      affine(11.16, 9.651, -0.62),
      { fromPbb: 12.84, basePbb: 1.691, slope: 0 },
    ],
  },

  jsaSenior: {
    // source: SKV 433 2026 §7.5.2 - skattereduktion för arbetsinkomst, 66 or older at the start of
    // the year: 22 % of the work income up to 1.75 PBB; 0.2635 PBB + 7 % of the work income up to
    // 5.24 PBB; 0.6293 PBB above. Credited against municipal tax only.
    tiers: [
      { fromPbb: 0, basePbb: 0, slope: 0.22 },
      affine(1.75, 0.2635, 0.07),
      { fromPbb: 5.24, basePbb: 0.6293, slope: 0 },
    ],
  },

  jsa: {
    // source: SKV 433 2026 §7.5.2 - skattereduktion för arbetsinkomst, under 66 at the start of the year:
    // (AI-GA)*KI up to 0.91 PBB; (0.91 PBB + 38.74 % x (AI-0.91 PBB) - GA)*KI up to 3.24 PBB;
    // (1.813 PBB + 25.1 % x (AI-3.24 PBB) - GA)*KI up to 8.08 PBB; (3.027 PBB - GA)*KI above.
    tiers: [
      { fromPbb: 0, basePbb: 0, slope: 1 },
      { fromPbb: 0.91, basePbb: 0.91, slope: 0.3874 },
      { fromPbb: 3.24, basePbb: 1.813, slope: 0.251 },
      { fromPbb: 8.08, basePbb: 3.027, slope: 0 },
    ],
  },

  // source: SKV 433 2026 §7.5.4 - skattereduktion för förvärvsinkomst: 0.75 % of (taxable income
  // - 40 000), max 1 500 kr (reached at 240 000), credited against municipal tax only.
  earnedIncomeCredit: { rate: 0.0075, base: 40_000, max: 1_500 },

  // source: SKV 433 2026 §7.4 - 7 % up to 8.07 IBB, offset by an equal tax reduction
  publicPensionFee: { rate: 0.07, incomeCapIbb: 8.07 },
  // source: SKV 433 2026 - public service-avgift 1 % of taxable income, max 1.42 IBB x 1 % = 1 184 kr
  publicServiceFee: { rate: 0.01, maxIbbMultiple: 1.42 },

  // VERIFY: ITP 1 - 4.5 % up to 7.5 IBB/month, 30 % above
  itp1: { lowRate: 0.045, highRate: 0.3, thresholdIbb: 7.5 },

  semester: {
    days: 25,
    // source: Semesterlagen (0.43 % of monthly salary per day)
    supplementPerDayLegal: 0.0043,
    // VERIFY: common collective agreements (0.8 % per day)
    supplementPerDayAgreement: 0.008,
    compensationPct: 0.12,
  },

  threeTwelve: {
    // source: 2/3 x 30 % capital tax
    dividendTaxRate: 0.2,
    // source: 3:12 from 2026 - grundbelopp 4 IBB (IBB of the previous year) per company = 322 400
    grundbeloppIbbMultiple: 4,
    // VERIFY: 50 % rate of the wage-based space (the 8 IBB deduction is confirmed)
    wageBasedRate: 0.5,
    wageDeductionIbbMultiple: 8,
    // VERIFY: takbelopp for excess taxed as employment income (historically 90 IBB)
    excessEmploymentCapIbb: 90,
    capitalTaxRate: 0.3,
  },

  // source: skatteverket.se - periodiseringsfond for sole traders: max 30 % of the income
  periodiseringsfond: { maxPct: 0.3 },

  // VERIFY: common practice uplift on salary exchange (configurable)
  loneVaxlingUplift: 0.058,

  // source: socialförsäkringsbalken - SGI cap 10 PBB
  sgiCapPbb: 10,
  // source: pensionsgrundande inkomst 7.5 IBB
  pgiCapIbb: 7.5,
};
