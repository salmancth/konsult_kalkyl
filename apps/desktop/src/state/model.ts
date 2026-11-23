import { scenarios, type CommonInput, type ScenarioId, type TargetMetric } from '@lyvan/engine';
import { getLocalities, localRates } from '@lyvan/rules';

export type RevenueMode = 'annual' | 'hourly';
export type Theme = 'system' | 'light' | 'dark';
export type Language = 'sv' | 'en';
export type { TargetMetric };

export interface Inputs {
  revenueMode: RevenueMode;
  revenue: number;
  hourlyRate: number;
  hours: number;
  overhead: number;
  birthYear: number;
  municipalRatePct: number;
  /** SCB municipality code the rate came from; null = custom / national average. */
  municipalityCode: string | null;
  churchMember: boolean;
  /** Offer tool: the net pay the consultant wants per month (SEK). */
  targetMonthlyNet: number;
  /** Offer tool: does the target count net cash only, or net cash plus pension? */
  targetMetric: TargetMetric;
  /** Offer tool: the scenario printed on the offer sheet. */
  offerScenario: ScenarioId;
  /** Per-scenario options (validated by the engine's zod schemas). */
  options: Partial<Record<ScenarioId, Record<string, unknown>>>;
}

export interface SavedCalc {
  id: string;
  name: string;
  createdAt: string;
  inputs: Inputs;
  effectiveRevenue: number;
  bestScenario: ScenarioId | null;
}

/** LYVAN's commercial defaults (open decisions in docs/04-plan.md), editable in the settings. */
export interface LyvanDefaults {
  /** Scenario 1: share of revenue LYVAN keeps. */
  firmRetentionPct: number;
  /** Scenario 2: LYVAN's cut of the pot. */
  firmCutPct: number;
  /** Scenario 5: broker fee. */
  brokerFeePct: number;
  /** Scenario 3: the platform's fee. */
  providerFeePct: number;
}

export const DEFAULT_LYVAN: LyvanDefaults = {
  firmRetentionPct: 0.3,
  firmCutPct: 0.2,
  brokerFeePct: 0.05,
  providerFeePct: 0.05,
};

export interface PersistedState {
  version: 2;
  language: Language;
  theme: Theme;
  taxYear: number;
  defaultMunicipalPct: number;
  lyvanDefaults: LyvanDefaults;
  inputs: Inputs;
  saved: SavedCalc[];
}

export const DEFAULT_MUNICIPAL_PCT = 32.38;
export const DEFAULT_TAX_YEAR = 2026;

/** Which default feeds which scenario option. */
export const LYVAN_DEFAULT_TARGETS: Record<keyof LyvanDefaults, { scenario: ScenarioId; key: string }> = {
  firmRetentionPct: { scenario: 'salaried', key: 'firmRetentionPct' },
  firmCutPct: { scenario: 'revenue-share', key: 'firmCutPct' },
  brokerFeePct: { scenario: 'own-ab', key: 'brokerFeePct' },
  providerFeePct: { scenario: 'umbrella', key: 'providerFeePct' },
};

export function optionsFromDefaults(d: LyvanDefaults): Inputs['options'] {
  const out: Inputs['options'] = {};
  for (const k of Object.keys(LYVAN_DEFAULT_TARGETS) as (keyof LyvanDefaults)[]) {
    const { scenario, key } = LYVAN_DEFAULT_TARGETS[k];
    out[scenario] = { ...(out[scenario] ?? {}), [key]: d[k] };
  }
  return out;
}

export function defaultInputs(
  municipalPct = DEFAULT_MUNICIPAL_PCT,
  lyvan: LyvanDefaults = DEFAULT_LYVAN,
): Inputs {
  return {
    revenueMode: 'annual',
    revenue: 1_500_000,
    hourlyRate: 1_000,
    hours: 1_500,
    overhead: 100_000,
    birthYear: 1985,
    municipalRatePct: municipalPct,
    municipalityCode: null,
    churchMember: false,
    targetMonthlyNet: 45_000,
    targetMetric: 'netCash',
    offerScenario: 'salaried',
    options: optionsFromDefaults(lyvan),
  };
}

export function effectiveRevenue(i: Inputs): number {
  return i.revenueMode === 'hourly' ? i.hourlyRate * i.hours : i.revenue;
}

/** Translate UI inputs into the engine's common input. */
export function toCommonInput(i: Inputs, taxYear: number): CommonInput {
  // A chosen municipality also brings the county's burial and church fee; a custom rate keeps the
  // national averages of the rule set.
  const local = i.municipalityCode ? localRatesFor(i.municipalityCode, taxYear) : undefined;
  return {
    taxYear,
    revenue: Math.max(0, effectiveRevenue(i)),
    overhead: Math.max(0, i.overhead),
    person: {
      birthYear: i.birthYear,
      municipalTaxRate: Math.min(0.4, Math.max(0.25, i.municipalRatePct / 100)),
      churchMember: i.churchMember,
      ...(local ? { burialFeeRate: local.burialFeeRate, churchFeeRate: local.churchFeeRate } : {}),
    },
  };
}

/** Local rates for a municipality code and tax year (undefined if unknown or no data for the year). */
export function localRatesFor(code: string, taxYear: number) {
  const data = getLocalities(taxYear);
  return data ? localRates(data, code) : undefined;
}

export function defaultPersisted(): PersistedState {
  return {
    version: 2,
    language: 'sv',
    theme: 'system',
    taxYear: DEFAULT_TAX_YEAR,
    defaultMunicipalPct: DEFAULT_MUNICIPAL_PCT,
    lyvanDefaults: { ...DEFAULT_LYVAN },
    inputs: defaultInputs(),
    saved: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Sanitising stored data. The store file is user-editable, so nothing in it is trusted.
// ---------------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

const SCENARIO_IDS: readonly string[] = scenarios.map((s) => s.id);
const TARGET_METRICS: readonly TargetMetric[] = ['netCash', 'consultantValue', 'totalValue'];

/** Keep only plain JSON values for known scenarios; the engine validates the actual values. */
function sanitizeOptions(raw: unknown): Inputs['options'] {
  const out: Inputs['options'] = {};
  if (!isRecord(raw)) return out;
  for (const id of SCENARIO_IDS) {
    const v = raw[id];
    if (!isRecord(v)) continue;
    try {
      out[id as ScenarioId] = JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
    } catch {
      /* not serialisable: drop it */
    }
  }
  return out;
}

export function sanitizeInputs(raw: unknown, base: Inputs): Inputs {
  if (!isRecord(raw)) return base;
  return {
    revenueMode: raw.revenueMode === 'hourly' ? 'hourly' : raw.revenueMode === 'annual' ? 'annual' : base.revenueMode,
    revenue: num(raw.revenue, base.revenue, 0, 1_000_000_000),
    hourlyRate: num(raw.hourlyRate, base.hourlyRate, 0, 100_000),
    hours: num(raw.hours, base.hours, 0, 10_000),
    overhead: num(raw.overhead, base.overhead, 0, 1_000_000_000),
    birthYear: Math.round(num(raw.birthYear, base.birthYear, 1900, 2100)),
    municipalRatePct: num(raw.municipalRatePct, base.municipalRatePct, 25, 40),
    municipalityCode: typeof raw.municipalityCode === 'string' && /^\d{4}$/.test(raw.municipalityCode) ? raw.municipalityCode : null,
    churchMember: typeof raw.churchMember === 'boolean' ? raw.churchMember : base.churchMember,
    targetMonthlyNet: num(raw.targetMonthlyNet, base.targetMonthlyNet, 0, 10_000_000),
    targetMetric: TARGET_METRICS.includes(raw.targetMetric as TargetMetric) ? (raw.targetMetric as TargetMetric) : base.targetMetric,
    offerScenario:
      typeof raw.offerScenario === 'string' && SCENARIO_IDS.includes(raw.offerScenario)
        ? (raw.offerScenario as ScenarioId)
        : base.offerScenario,
    options: 'options' in raw ? sanitizeOptions(raw.options) : base.options,
  };
}

function sanitizeDefaults(raw: unknown): LyvanDefaults {
  const r = isRecord(raw) ? raw : {};
  return {
    firmRetentionPct: num(r.firmRetentionPct, DEFAULT_LYVAN.firmRetentionPct, 0, 0.95),
    firmCutPct: num(r.firmCutPct, DEFAULT_LYVAN.firmCutPct, 0, 0.95),
    brokerFeePct: num(r.brokerFeePct, DEFAULT_LYVAN.brokerFeePct, 0, 0.5),
    providerFeePct: num(r.providerFeePct, DEFAULT_LYVAN.providerFeePct, 0, 0.2),
  };
}

function sanitizeSaved(raw: unknown, base: Inputs): SavedCalc[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedCalc[] = [];
  for (const item of raw.slice(0, 500)) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') continue;
    out.push({
      id: item.id,
      name: item.name.slice(0, 200),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date(0).toISOString(),
      inputs: sanitizeInputs(item.inputs, base),
      effectiveRevenue: num(item.effectiveRevenue, 0, 0, 1_000_000_000_000),
      bestScenario:
        typeof item.bestScenario === 'string' && SCENARIO_IDS.includes(item.bestScenario)
          ? (item.bestScenario as ScenarioId)
          : null,
    });
  }
  return out;
}

/**
 * Bring any stored blob (version 1 or 2, or garbage) up to the current schema.
 * Unknown/invalid fields fall back to defaults; nothing here throws.
 */
export function migrate(raw: unknown): PersistedState {
  const base = defaultPersisted();
  if (!isRecord(raw)) return base;
  // v1 -> v2: added theme, taxYear and lyvanDefaults. Missing fields simply take their defaults.
  const lyvanDefaults = sanitizeDefaults(raw.lyvanDefaults);
  const defaultMunicipalPct = num(raw.defaultMunicipalPct, base.defaultMunicipalPct, 25, 40);
  const inputsBase = defaultInputs(defaultMunicipalPct, lyvanDefaults);
  const theme = raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : base.theme;
  return {
    version: 2,
    language: raw.language === 'en' ? 'en' : 'sv',
    theme,
    taxYear: Math.round(num(raw.taxYear, base.taxYear, 2000, 2100)),
    defaultMunicipalPct,
    lyvanDefaults,
    inputs: sanitizeInputs(raw.inputs, inputsBase),
    saved: sanitizeSaved(raw.saved, inputsBase),
  };
}
