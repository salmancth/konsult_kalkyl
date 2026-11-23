import { z } from 'zod';
import { pensionModelSchema } from '../../tax/pension';

export const umbrellaSchema = z.object({
  /** Platform fee as share of invoiced revenue (typically 2-6 %). */
  providerFeePct: z.number().min(0).max(0.2).default(0.05),
  /** Pension, default none. */
  pensionModel: pensionModelSchema.default({ kind: 'none' }),
});

export type UmbrellaOptions = z.output<typeof umbrellaSchema>;
