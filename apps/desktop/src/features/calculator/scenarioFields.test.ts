import { SE_2026 } from '@lyvan/rules';
import { calculateAllSettled, scenarios, type ScenarioId } from '@lyvan/engine';
import { describe, expect, it } from 'vitest';
import { SCENARIO_FIELDS, resolveBound } from './scenarioFields';

const common = { revenue: 1_500_000, overhead: 100_000 };

/**
 * The UI clamps numeric fields to the ranges in SCENARIO_FIELDS. If a range were wider than the
 * engine's zod schema, the user could type a value that makes the whole scenario fail. These tests
 * pin the two together: every minimum and maximum the UI allows must be accepted by the engine.
 */
describe('scenario field bounds match the engine schemas', () => {
  for (const s of scenarios) {
    for (const f of SCENARIO_FIELDS[s.id]) {
      if (f.type === 'bool' || f.type === 'select' || f.type === 'pension') continue;
      const min = resolveBound(f.min, SE_2026);
      const max = resolveBound(f.max, SE_2026);
      for (const [label, v] of [['min', min], ['max', max]] as const) {
        if (v === undefined) continue;
        it(`${s.id}.${f.key} at its UI ${label} (${v}) is accepted`, () => {
          const options: Partial<Record<ScenarioId, Record<string, unknown>>> = { [s.id]: { [f.key]: v } };
          const { failures } = calculateAllSettled(common, options, SE_2026);
          expect(failures.filter((x) => x.scenarioId === s.id)).toEqual([]);
        });
      }
    }
  }

  it('values just outside the UI range are rejected (the bounds are not accidentally loose)', () => {
    const cases: [ScenarioId, string, number][] = [
      ['salaried', 'firmRetentionPct', 0.96],
      ['revenue-share', 'firmCutPct', 0.96],
      ['umbrella', 'providerFeePct', 0.21],
      ['own-ab', 'brokerFeePct', 0.51],
      ['own-ab', 'ownershipPct', 0],
      ['own-ab', 'pensionWeight', 1.6],
    ];
    for (const [id, key, v] of cases) {
      const { failures } = calculateAllSettled(common, { [id]: { [key]: v } }, SE_2026);
      expect(failures.map((f) => f.scenarioId), `${id}.${key}=${v}`).toContain(id);
    }
  });

  it('the pension "percent" model accepts 0 and 100 %', () => {
    for (const pct of [0, 1]) {
      const { failures } = calculateAllSettled(common, { salaried: { pensionModel: { kind: 'pct', pct } } }, SE_2026);
      expect(failures).toEqual([]);
    }
  });

  it('every select option is accepted by the engine', () => {
    for (const s of scenarios) {
      for (const f of SCENARIO_FIELDS[s.id].filter((x) => x.type === 'select')) {
        for (const o of f.options ?? []) {
          const { failures } = calculateAllSettled(common, { [s.id]: { [f.key]: o.value } }, SE_2026);
          expect(failures, `${s.id}.${f.key}=${o.value}`).toEqual([]);
        }
      }
    }
  });

  it('the periodiseringsfond maximum comes from the rule set', () => {
    const f = SCENARIO_FIELDS['sole-trader'].find((x) => x.key === 'periodiseringsfondPct')!;
    expect(resolveBound(f.max, SE_2026)).toBe(SE_2026.periodiseringsfond.maxPct);
  });
});
