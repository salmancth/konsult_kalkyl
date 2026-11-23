import { z } from 'zod';
import type { RuleSet } from '@lyvan/rules';

export const personSchema = z.object({
  birthYear: z.number().int().min(1900).max(2100).default(1985),
  /** Kommun + region, e.g. 0.3238. Falls back to the rule-set average when omitted. */
  municipalTaxRate: z.number().min(0.25).max(0.40).optional(),
  churchMember: z.boolean().default(false),
  churchFeeRate: z.number().min(0).max(0.03).optional(),
  burialFeeRate: z.number().min(0).max(0.01).optional(),
});

export const commonInputSchema = z.object({
  taxYear: z.number().int().default(2026),
  /** Annual billed revenue, SEK ex. VAT. */
  revenue: z.number().min(0),
  /** Direct costs per year (accounting, IT, insurance...). */
  overhead: z.number().min(0).default(0),
  person: personSchema.default({ birthYear: 1985, churchMember: false }),
});

export type CommonInput = z.input<typeof commonInputSchema>;

export interface ResolvedPerson {
  birthYear: number;
  municipalTaxRate: number;
  churchMember: boolean;
  churchFeeRate: number;
  burialFeeRate: number;
}

export interface ResolvedCommon {
  taxYear: number;
  revenue: number;
  overhead: number;
  person: ResolvedPerson;
}

/** One validation problem, with a dotted path such as `person.birthYear` or `firmCutPct`. */
export interface InputIssue {
  path: string;
  /** English validator message (for logs); UIs should build their own text from `code` and `limit`. */
  message: string;
  /** Validator code, e.g. `too_big`, `too_small`, `invalid_type`. */
  code: string;
  /** The bound that was violated, for `too_big` (maximum) and `too_small` (minimum). */
  limit?: number;
}

/** Thrown when user-supplied input fails validation. UIs should show `issues`, not `message`. */
export class EngineInputError extends Error {
  readonly issues: InputIssue[];
  /** `common` or a scenario id. */
  readonly scope: string;

  constructor(scope: string, issues: InputIssue[]) {
    super(`Invalid ${scope} input: ${issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ')}`);
    this.name = 'EngineInputError';
    this.scope = scope;
    this.issues = issues;
  }
}

/** Parse with a zod schema and convert failures to a readable EngineInputError. */
export function parseInput<T>(schema: z.ZodType<T, unknown>, value: unknown, scope: string): T {
  const res = schema.safeParse(value);
  if (res.success) return res.data;
  throw new EngineInputError(
    scope,
    res.error.issues.map((i): InputIssue => {
      const issue: InputIssue = { path: i.path.map(String).join('.'), message: i.message, code: i.code };
      const bound = 'maximum' in i ? i.maximum : 'minimum' in i ? i.minimum : undefined;
      if (typeof bound === 'number') issue.limit = bound;
      return issue;
    }),
  );
}

/** Validate and fill defaults from the rule set. */
export function resolveCommon(input: CommonInput, rules: RuleSet): ResolvedCommon {
  const parsed = parseInput(commonInputSchema, input, 'common');
  const p = parsed.person;
  return {
    taxYear: parsed.taxYear,
    revenue: parsed.revenue,
    overhead: parsed.overhead,
    person: {
      birthYear: p.birthYear,
      municipalTaxRate: p.municipalTaxRate ?? rules.municipalTaxAverage,
      churchMember: p.churchMember,
      churchFeeRate: p.churchFeeRate ?? rules.defaultChurchFeeRate,
      burialFeeRate: p.burialFeeRate ?? rules.burialFeeAverage,
    },
  };
}
