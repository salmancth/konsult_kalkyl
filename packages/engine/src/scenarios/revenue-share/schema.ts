import { z } from 'zod';
import { holidayModelSchema } from '../../tax/holiday';
import { pensionModelSchema } from '../../tax/pension';

export const revenueShareSchema = z.object({
  /** LYVAN's cut of billed revenue (70/30 -> 0.30, 80/20 -> 0.20). */
  firmCutPct: z.number().min(0).max(0.95).default(0.2),
  /** If true the consultant's overhead is paid out of the pot instead of by LYVAN. */
  overheadFromPot: z.boolean().default(false),
  pensionModel: pensionModelSchema.default({ kind: 'itp1' }),
  /** Gross salary given up for extra occupational pension (löneväxling), SEK/year. */
  loneVaxling: z.number().min(0).default(0),
  /** Pot models usually include 12 % semesterersättning in the pot. */
  holidayModel: holidayModelSchema.default('compensation'),
});

export type RevenueShareOptions = z.output<typeof revenueShareSchema>;
