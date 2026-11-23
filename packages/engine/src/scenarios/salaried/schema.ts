import { z } from 'zod';
import { holidayModelSchema } from '../../tax/holiday';
import { pensionModelSchema } from '../../tax/pension';

export const salariedSchema = z.object({
  /** Share of revenue LYVAN keeps for sales, bench and profit (overhead is paid from it). */
  firmRetentionPct: z.number().min(0).max(0.95).default(0.3),
  pensionModel: pensionModelSchema.default({ kind: 'itp1' }),
  holidayModel: holidayModelSchema.default('supplement-legal'),
});

export type SalariedOptions = z.output<typeof salariedSchema>;
