import { z } from 'zod';
import type { RuleSet } from '@lyvan/rules';
import type { ResolvedCommon } from '../common';
import type { ScenarioId, ScenarioResult } from '../types';

export interface ScenarioDefinition<I extends object = object> {
  id: ScenarioId;
  /** i18n key. */
  labelKey: string;
  descriptionKey: string;
  /** Validation + defaults for scenario-specific options. */
  inputSchema: z.ZodType<I, unknown>;
  defaults(rules: RuleSet): I;
  calculate(common: ResolvedCommon, input: I, rules: RuleSet): ScenarioResult;
}

/** Request for the public API: common inputs + optional scenario options. */
export interface ScenarioInput {
  common: import('../common').CommonInput;
  options?: Record<string, unknown>;
}
