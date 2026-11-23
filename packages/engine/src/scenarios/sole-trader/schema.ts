import { z } from 'zod';

export const soleTraderSchema = z.object({
  /**
   * Share of the income put into a periodiseringsfond, deferring tax. The statutory maximum
   * (30 % in 2026) comes from the rule set; larger values are capped with a warning.
   */
  periodiseringsfondPct: z.number().min(0).max(1).default(0),
});

export type SoleTraderOptions = z.output<typeof soleTraderSchema>;
