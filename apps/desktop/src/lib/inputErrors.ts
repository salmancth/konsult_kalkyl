import type { InputIssue, ScenarioFailure } from '@lyvan/engine';

type T = (key: string, options?: Record<string, unknown>) => string;

const COMMON_LABELS: Record<string, string> = {
  revenue: 'input.revenue',
  overhead: 'input.overhead',
  taxYear: 'input.taxYear',
  'person.birthYear': 'input.birthYear',
  'person.municipalTaxRate': 'input.municipalRate',
  'person.churchFeeRate': 'input.church',
  'person.burialFeeRate': 'input.church',
};

/** Localised text for a validation problem; falls back to the validator's English message. */
function issueText(t: T, issue: InputIssue): string {
  if (issue.limit === undefined || (issue.code !== 'too_big' && issue.code !== 'too_small')) {
    return issue.code === 'invalid_type' ? t('error.invalidValue') : issue.message;
  }
  // Percent options are stored as fractions (0.2 = 20 %): show them the way the user types them.
  const isPct = /Pct$/.test(issue.path.split('.').pop() ?? '');
  const limit = isPct ? `${Math.round(issue.limit * 1000) / 10} %` : String(issue.limit);
  return t(issue.code === 'too_big' ? 'error.tooBig' : 'error.tooSmall', { limit });
}

/** "LYVAN keeps (%): at most 95 %" - a field label plus a localised reason. */
export function describeIssue(t: T, failure: Pick<ScenarioFailure, 'scope'>, issue: InputIssue): string {
  const root = issue.path.split('.')[0] ?? '';
  const labelKey =
    failure.scope === 'common' ? COMMON_LABELS[issue.path] : root ? `opt.${root}` : undefined;
  const label = labelKey ? t(labelKey, { defaultValue: issue.path }) : issue.path;
  return `${label}: ${issueText(t, issue)}`;
}

/** Distinct issues of all failures, so common-input problems (which fail every scenario) show once. */
export function uniqueFailureLines(t: T, failures: ScenarioFailure[]): { scenarioId: string; lines: string[] }[] {
  const seenCommon = new Set<string>();
  const out: { scenarioId: string; lines: string[] }[] = [];
  for (const f of failures) {
    const lines: string[] = [];
    for (const issue of f.issues) {
      const text = describeIssue(t, f, issue);
      if (f.scope === 'common') {
        if (seenCommon.has(text)) continue;
        seenCommon.add(text);
      }
      lines.push(text);
    }
    out.push({ scenarioId: f.scenarioId, lines });
  }
  return out;
}
