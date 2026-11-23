import { describe, expect, it } from 'vitest';
import { SE_2026 } from '@lyvan/rules';
import { calculateAll } from '@lyvan/engine';
import {
  DEFAULT_LYVAN,
  defaultInputs,
  defaultPersisted,
  effectiveRevenue,
  migrate,
  optionsFromDefaults,
  sanitizeInputs,
  toCommonInput,
} from './model';

describe('model', () => {
  it('derives revenue from hourly mode', () => {
    const i = { ...defaultInputs(), revenueMode: 'hourly' as const, hourlyRate: 1000, hours: 1500 };
    expect(effectiveRevenue(i)).toBe(1_500_000);
    expect(effectiveRevenue({ ...i, revenueMode: 'annual', revenue: 42 })).toBe(42);
  });

  it('maps UI inputs to a valid engine request', () => {
    const inputs = defaultInputs();
    const common = toCommonInput(inputs, 2026);
    expect(common.person?.municipalTaxRate).toBeCloseTo(0.3238, 6);
    const results = calculateAll(common, inputs.options, SE_2026);
    expect(results).toHaveLength(5);
  });

  it('clamps nonsense inputs', () => {
    const common = toCommonInput({ ...defaultInputs(), revenue: -5, overhead: -1, municipalRatePct: 99 }, 2026);
    expect(common.revenue).toBe(0);
    expect(common.overhead).toBe(0);
    expect(common.person?.municipalTaxRate).toBe(0.4);
  });

  it('seeds the scenario options from the LYVAN defaults', () => {
    const o = optionsFromDefaults({ firmRetentionPct: 0.25, firmCutPct: 0.15, brokerFeePct: 0.02, providerFeePct: 0.06 });
    expect(o.salaried).toEqual({ firmRetentionPct: 0.25 });
    expect(o['revenue-share']).toEqual({ firmCutPct: 0.15 });
    expect(o['own-ab']).toEqual({ brokerFeePct: 0.02 });
    expect(o.umbrella).toEqual({ providerFeePct: 0.06 });
    expect(defaultInputs().options).toEqual(optionsFromDefaults(DEFAULT_LYVAN));
  });
});

describe('migrate', () => {
  it('returns defaults for unknown data', () => {
    expect(migrate(null)).toEqual(defaultPersisted());
    expect(migrate('x')).toEqual(defaultPersisted());
    expect(migrate([1, 2])).toEqual(defaultPersisted());
  });

  it('upgrades a version-1 blob (no theme / taxYear / lyvanDefaults)', () => {
    const m = migrate({ version: 1, language: 'en', inputs: { revenue: 5 }, saved: 'bad' });
    expect(m.version).toBe(2);
    expect(m.language).toBe('en');
    expect(m.theme).toBe('system');
    expect(m.taxYear).toBe(2026);
    expect(m.lyvanDefaults).toEqual(DEFAULT_LYVAN);
    expect(m.inputs.revenue).toBe(5);
    expect(m.inputs.overhead).toBe(100_000);
    expect(m.saved).toEqual([]);
  });

  it('round-trips the current schema', () => {
    const p = defaultPersisted();
    expect(migrate(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('never trusts the stored values', () => {
    const m = migrate({
      language: 'de',
      theme: 'purple',
      taxYear: 'x',
      defaultMunicipalPct: 500,
      lyvanDefaults: { firmCutPct: 9, brokerFeePct: 'a' },
      inputs: {
        revenue: 'abc',
        hours: -4,
        birthYear: 1500.4,
        municipalRatePct: Number.NaN,
        churchMember: 'yes',
        revenueMode: 'weekly',
        options: { salaried: 'nope', umbrella: { providerFeePct: 0.1 }, bogus: { a: 1 } },
      },
      saved: [
        { id: 'a', name: 'ok', inputs: { revenue: 7 }, effectiveRevenue: 7, bestScenario: 'own-ab', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 5, name: 'bad id' },
        { id: 'b', name: 'x', bestScenario: 'nope' },
        null,
      ],
    });
    expect(m.language).toBe('sv');
    expect(m.theme).toBe('system');
    expect(m.taxYear).toBe(2026);
    expect(m.defaultMunicipalPct).toBe(40);
    expect(m.lyvanDefaults.firmCutPct).toBe(0.95);
    expect(m.lyvanDefaults.brokerFeePct).toBe(DEFAULT_LYVAN.brokerFeePct);
    expect(m.inputs.revenue).toBe(1_500_000);
    expect(m.inputs.hours).toBe(0);
    expect(m.inputs.birthYear).toBe(1900);
    // an unusable stored rate falls back to the (clamped) default municipal rate
    expect(m.inputs.municipalRatePct).toBe(40);
    expect(m.inputs.churchMember).toBe(false);
    expect(m.inputs.revenueMode).toBe('annual');
    expect(Object.keys(m.inputs.options)).toEqual(['umbrella']);
    expect(m.saved.map((s) => s.id)).toEqual(['a', 'b']);
    expect(m.saved[0]?.inputs.revenue).toBe(7);
    expect(m.saved[1]?.bestScenario).toBeNull();
  });

  it('keeps explicitly stored scenario options', () => {
    const base = defaultInputs();
    const i = sanitizeInputs({ options: { 'own-ab': { salaryStrategy: 'custom', customSalary: 500_000 } } }, base);
    expect(i.options['own-ab']).toEqual({ salaryStrategy: 'custom', customSalary: 500_000 });
  });
});

describe('municipality choice', () => {
  it('a chosen municipality brings the county church and burial fee', () => {
    const c = toCommonInput({ ...defaultInputs(), municipalityCode: '0180', municipalRatePct: 30.55 }, 2026);
    expect(c.person?.burialFeeRate).toBe(0.002);
    expect(c.person?.churchFeeRate).toBeCloseTo(0.0083, 6); // Stockholm county: 1.03 % incl. 0.20 % burial
    expect(c.person?.municipalTaxRate).toBeCloseTo(0.3055, 6);
  });

  it('a custom rate leaves the fees to the rule-set averages', () => {
    const c = toCommonInput(defaultInputs(), 2026);
    expect(c.person?.burialFeeRate).toBeUndefined();
    expect(c.person?.churchFeeRate).toBeUndefined();
  });

  it('an unknown code or a year without data is ignored', () => {
    expect(toCommonInput({ ...defaultInputs(), municipalityCode: '9999' }, 2026).person?.burialFeeRate).toBeUndefined();
    expect(toCommonInput({ ...defaultInputs(), municipalityCode: '0180' }, 1999).person?.burialFeeRate).toBeUndefined();
  });

  it('sanitising keeps a well-formed code and drops anything else', () => {
    const base = defaultInputs();
    expect(sanitizeInputs({ municipalityCode: '0180' }, base).municipalityCode).toBe('0180');
    expect(sanitizeInputs({ municipalityCode: 'Stockholm' }, base).municipalityCode).toBeNull();
    expect(sanitizeInputs({ municipalityCode: 180 }, base).municipalityCode).toBeNull();
    expect(migrate({ inputs: { municipalityCode: '1480' } }).inputs.municipalityCode).toBe('1480');
  });
});

describe('offer inputs', () => {
  it('have defaults and are sanitised', () => {
    const base = defaultInputs();
    expect(base.targetMonthlyNet).toBe(45_000);
    expect(base.targetMetric).toBe('netCash');
    expect(base.offerScenario).toBe('salaried');
    const i = sanitizeInputs({ targetMonthlyNet: -5, targetMetric: 'bogus', offerScenario: 'nope' }, base);
    expect(i.targetMonthlyNet).toBe(0);
    expect(i.targetMetric).toBe('netCash');
    expect(i.offerScenario).toBe('salaried');
    expect(sanitizeInputs({ targetMetric: 'totalValue' }, base).targetMetric).toBe('totalValue');
    const ok = sanitizeInputs({ targetMonthlyNet: 60_000, targetMetric: 'consultantValue', offerScenario: 'own-ab' }, base);
    expect(ok.targetMonthlyNet).toBe(60_000);
    expect(ok.targetMetric).toBe('consultantValue');
    expect(ok.offerScenario).toBe('own-ab');
  });

  it('an old stored blob without them still loads', () => {
    const m = migrate({ version: 2, inputs: { revenue: 900_000 } });
    expect(m.inputs.revenue).toBe(900_000);
    expect(m.inputs.targetMonthlyNet).toBe(45_000);
  });
});
