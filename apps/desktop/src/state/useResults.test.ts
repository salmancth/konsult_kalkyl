import { describe, expect, it } from 'vitest';
import { defaultInputs } from './model';
import { availableTaxYears, compute, resolveRules } from './useResults';
import { describeIssue, uniqueFailureLines } from '../lib/inputErrors';

// Stand-in for i18next's `t`: returns the key (a real catalogue would return the label).
const t = (key: string): string => key;

describe('compute', () => {
  it('returns all five scenarios for the default inputs', () => {
    const c = compute(defaultInputs(), 2026);
    expect(c.error).toBeNull();
    expect(c.failures).toEqual([]);
    expect(c.results.map((r) => r.scenarioId)).toEqual(['salaried', 'revenue-share', 'umbrella', 'sole-trader', 'own-ab']);
    expect(c.rules.id).toBe('SE-2026');
  });

  it('one scenario with invalid settings does not take the others down', () => {
    const inputs = defaultInputs();
    inputs.options = { ...inputs.options, umbrella: { providerFeePct: 1 } };
    const c = compute(inputs, 2026);
    expect(c.error).toBeNull();
    expect(c.results).toHaveLength(4);
    expect(c.failures.map((f) => f.scenarioId)).toEqual(['umbrella']);
    expect(c.failures[0]?.issues[0]?.path).toBe('providerFeePct');
  });

  it('invalid common input fails every scenario once, and is described once', () => {
    const inputs = { ...defaultInputs(), birthYear: 3000 };
    const c = compute(inputs, 2026);
    expect(c.results).toHaveLength(0);
    expect(c.failures).toHaveLength(5);
    const groups = uniqueFailureLines(t, c.failures);
    expect(groups.flatMap((g) => g.lines)).toHaveLength(1);
    expect(groups[0]?.lines[0]).toContain('input.birthYear');
    expect(c.failures[0]?.issues[0]).toMatchObject({ code: 'too_big', limit: 2100 });
  });

  it('falls back to a known rule set for an unknown tax year', () => {
    expect(resolveRules(1999).year).toBe(2026);
    expect(availableTaxYears()).toContain(2026);
  });

  it('is stable: same inputs give the same results', () => {
    const i = defaultInputs();
    expect(compute(i, 2026).results.map((r) => r.totals.netCash)).toEqual(compute(i, 2026).results.map((r) => r.totals.netCash));
  });
});

describe('describeIssue', () => {
  it('labels scenario options and common fields', () => {
    const big = { path: 'firmRetentionPct', message: 'Too big', code: 'too_big', limit: 0.95 };
    expect(describeIssue(t, { scope: 'salaried' }, big)).toBe('opt.firmRetentionPct: error.tooBig');
    expect(describeIssue(t, { scope: 'common' }, { path: 'person.birthYear', message: 'Too big', code: 'too_big', limit: 2100 })).toBe(
      'input.birthYear: error.tooBig',
    );
    expect(describeIssue(t, { scope: 'common' }, { path: '', message: 'Invalid input', code: 'custom' })).toBe(': Invalid input');
    expect(describeIssue(t, { scope: 'salaried' }, { path: 'x', message: 'm', code: 'invalid_type' })).toContain('error.invalidValue');
  });
});
