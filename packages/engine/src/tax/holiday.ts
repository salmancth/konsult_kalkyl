import { z } from 'zod';
import type { RuleSet } from '@lyvan/rules';

export const holidayModelSchema = z.enum([
  /** Monthly-salaried: salary continues; legal minimum supplement per day. */
  'supplement-legal',
  /** Monthly-salaried: collective-agreement supplement per day. */
  'supplement-agreement',
  /** Hourly/umbrella/pot models: 12 % semesterersättning on top. */
  'compensation',
  'none',
]);

export type HolidayModel = z.infer<typeof holidayModelSchema>;

/** Holiday pay on top of base salary S (annual). */
export function holidayPay(model: HolidayModel, salary: number, rules: RuleSet): number {
  if (salary <= 0) return 0;
  switch (model) {
    case 'supplement-legal':
      return rules.semester.supplementPerDayLegal * rules.semester.days * (salary / 12);
    case 'supplement-agreement':
      return rules.semester.supplementPerDayAgreement * rules.semester.days * (salary / 12);
    case 'compensation':
      return rules.semester.compensationPct * salary;
    case 'none':
      return 0;
  }
}
