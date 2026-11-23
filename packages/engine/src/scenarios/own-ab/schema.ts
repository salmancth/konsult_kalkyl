import { z } from 'zod';
import { pensionModelSchema } from '../../tax/pension';

export const ownAbSchema = z.object({
  /** LYVAN's broker fee when the consultant's own AB is subcontracted via LYVAN (0 = direct). */
  brokerFeePct: z.number().min(0).max(0.5).default(0.05),
  salaryStrategy: z.enum(['brytpunkt', 'custom', 'optimize']).default('brytpunkt'),
  /** Used when salaryStrategy = 'custom'. */
  customSalary: z.number().min(0).default(0),
  pensionModel: pensionModelSchema.default({ kind: 'itp1' }),
  /** Owner's share of the AB, 0..1. */
  ownershipPct: z.number().min(0.01).max(1).default(1),
  /** Number of owners in the company (info, drives the shared-grundbelopp warning). */
  ownersInCompany: z.number().int().min(1).default(1),
  /** Sparat utdelningsutrymme carried in. */
  savedDividendSpace: z.number().min(0).default(0),
  /** If true, dividends are capped at the gränsbelopp and the rest stays in the AB. */
  capDividendAtGransbelopp: z.boolean().default(true),
  /** Optimizer: value of 1 kr of pension premium relative to 1 kr net cash. */
  pensionWeight: z.number().min(0).max(1.5).default(0.6),
  /** Optimizer: value of 1 kr left in the AB relative to 1 kr net cash. */
  retainedWeight: z.number().min(0).max(1.5).default(0.7),
});

export type OwnAbOptions = z.output<typeof ownAbSchema>;
