export type ScenarioId = 'salaried' | 'revenue-share' | 'umbrella' | 'sole-trader' | 'own-ab';

export type Party = 'consultant' | 'company' | 'state' | 'pension' | 'provider' | 'external';

export type LineKind =
  | 'revenue'
  | 'cost'
  | 'tax'
  | 'fee'
  | 'payout'
  | 'pension'
  | 'retained'
  | 'subtotal';

/** Kinds that are informational and NOT part of the revenue allocation sum. */
export const NON_ALLOCATION_KINDS: ReadonlySet<LineKind> = new Set(['revenue', 'subtotal']);

export interface Line {
  /** Stable id, e.g. 'employer_fees'. */
  key: string;
  /** i18n key. */
  labelKey: string;
  /** SEK, whole kronor. Allocation lines: positive = money going to `party`; negative = refund/credit. */
  amount: number;
  party: Party;
  kind: LineKind;
  pctOfRevenue: number;
  /** Human-readable formula for audit. */
  formula?: string;
}

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface Warning {
  code: string;
  severity: WarningSeverity;
  params?: Record<string, number | string>;
}

export interface Totals {
  revenue: number;
  /** Salary (+ holiday pay) (+ dividend before personal tax where relevant). */
  grossPayout: number;
  /** Cash in the consultant's pocket after all personal taxes (excl. pension, excl. retained). */
  netCash: number;
  /** Pension premiums (excl. särskild löneskatt). */
  pensionValue: number;
  /** netCash + pensionValue. */
  consultantValue: number;
  /** All taxes and fees to the state (incl. SLP, employer fees, corporate tax, personal tax). */
  totalToState: number;
  /** LYVAN margin (retention / cut / broker fee). */
  companyRetained: number;
  /** Provider (umbrella) fee. */
  providerFee: number;
  /** Money retained for the consultant (own AB retained earnings / periodiseringsfond). */
  retainedForConsultant: number;
  /** Direct overhead paid to third parties. */
  overhead: number;
  /** totalToState / (revenue - overhead - company - provider). */
  effectiveTaxRate: number;
  netPctOfRevenue: number;
}

export interface ScenarioResult {
  scenarioId: ScenarioId;
  lines: Line[];
  totals: Totals;
  warnings: Warning[];
  /** i18n keys of assumptions applied. */
  assumptions: string[];
  meta: {
    ruleSetId: string;
    ruleSetVerified: boolean;
    engineVersion: string;
    /** Rounding residual absorbed into the balancing line (kr). */
    balanceAdjustment: number;
    /** Scenario specific extras (e.g. chosen salary), for UI display. */
    details: Record<string, number | string>;
  };
}
