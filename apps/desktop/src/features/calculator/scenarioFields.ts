import type { RuleSet } from '@lyvan/rules';
import type { ScenarioId } from '@lyvan/engine';

export type FieldType = 'pct' | 'kr' | 'int' | 'ratio' | 'bool' | 'select' | 'pension';

/** A bound that may depend on the rule set (e.g. the statutory periodiseringsfond maximum). */
export type Bound = number | ((rules: RuleSet) => number);

export interface FieldDef {
  key: string;
  labelKey: string;
  type: FieldType;
  /**
   * Allowed range, MIRRORING the engine's zod schema for the scenario (a test checks that the
   * minimum and maximum are accepted by the engine). Percent fields are fractions (0.3 = 30 %).
   */
  min?: Bound;
  max?: Bound;
  options?: { value: string; labelKey: string }[];
  /** Only show when predicate on current scenario options is true. */
  showIf?: (opts: Record<string, unknown>) => boolean;
}

export function resolveBound(b: Bound | undefined, rules: RuleSet): number | undefined {
  return typeof b === 'function' ? b(rules) : b;
}

const holidayOptions = ['supplement-legal', 'supplement-agreement', 'compensation', 'none'].map((v) => ({
  value: v,
  labelKey: `opt.holiday.${v}`,
}));

/**
 * UI descriptors for each scenario's options. When adding a scenario, add its fields here
 * (the engine validates the values with the scenario's zod schema).
 */
export const SCENARIO_FIELDS: Record<ScenarioId, FieldDef[]> = {
  salaried: [
    { key: 'firmRetentionPct', labelKey: 'opt.firmRetentionPct', type: 'pct', min: 0, max: 0.95 },
    { key: 'pensionModel', labelKey: 'opt.pensionModel', type: 'pension' },
    { key: 'holidayModel', labelKey: 'opt.holidayModel', type: 'select', options: holidayOptions },
  ],
  'revenue-share': [
    { key: 'firmCutPct', labelKey: 'opt.firmCutPct', type: 'pct', min: 0, max: 0.95 },
    { key: 'overheadFromPot', labelKey: 'opt.overheadFromPot', type: 'bool' },
    { key: 'pensionModel', labelKey: 'opt.pensionModel', type: 'pension' },
    { key: 'loneVaxling', labelKey: 'opt.loneVaxling', type: 'kr', min: 0 },
    { key: 'holidayModel', labelKey: 'opt.holidayModel', type: 'select', options: holidayOptions },
  ],
  umbrella: [
    { key: 'providerFeePct', labelKey: 'opt.providerFeePct', type: 'pct', min: 0, max: 0.2 },
    { key: 'pensionModel', labelKey: 'opt.pensionModel', type: 'pension' },
  ],
  'sole-trader': [
    {
      key: 'periodiseringsfondPct',
      labelKey: 'opt.periodiseringsfondPct',
      type: 'pct',
      min: 0,
      max: (r) => r.periodiseringsfond.maxPct,
    },
  ],
  'own-ab': [
    { key: 'brokerFeePct', labelKey: 'opt.brokerFeePct', type: 'pct', min: 0, max: 0.5 },
    {
      key: 'salaryStrategy',
      labelKey: 'opt.salaryStrategy',
      type: 'select',
      options: ['brytpunkt', 'custom', 'optimize'].map((v) => ({ value: v, labelKey: `opt.strategy.${v}` })),
    },
    {
      key: 'customSalary',
      labelKey: 'opt.customSalary',
      type: 'kr',
      min: 0,
      showIf: (o) => o.salaryStrategy === 'custom',
    },
    {
      key: 'pensionWeight',
      labelKey: 'opt.pensionWeight',
      type: 'ratio',
      min: 0,
      max: 1.5,
      showIf: (o) => o.salaryStrategy === 'optimize',
    },
    {
      key: 'retainedWeight',
      labelKey: 'opt.retainedWeight',
      type: 'ratio',
      min: 0,
      max: 1.5,
      showIf: (o) => o.salaryStrategy === 'optimize',
    },
    { key: 'pensionModel', labelKey: 'opt.pensionModel', type: 'pension' },
    { key: 'ownershipPct', labelKey: 'opt.ownershipPct', type: 'pct', min: 0.01, max: 1 },
    { key: 'ownersInCompany', labelKey: 'opt.ownersInCompany', type: 'int', min: 1, max: 50 },
    { key: 'savedDividendSpace', labelKey: 'opt.savedDividendSpace', type: 'kr', min: 0 },
    { key: 'capDividendAtGransbelopp', labelKey: 'opt.capDividendAtGransbelopp', type: 'bool' },
  ],
};
