import { SE_2026 } from '@lyvan/rules';
import { calculateAll, fmtKr } from './index';

const revenue = Number(process.argv[2] ?? 1_500_000);
const overhead = Number(process.argv[3] ?? 100_000);
const results = calculateAll({ revenue, overhead }, {}, SE_2026);

console.log(`LYVAN Payout demo - revenue ${fmtKr(revenue)} kr, overhead ${fmtKr(overhead)} kr (rules ${SE_2026.id}, verified=${SE_2026.verified})`);
console.table(
  results.map((r) => ({
    scenario: r.scenarioId,
    gross: fmtKr(r.totals.grossPayout),
    netCash: fmtKr(r.totals.netCash),
    'net %': (r.totals.netPctOfRevenue * 100).toFixed(1),
    pension: fmtKr(r.totals.pensionValue),
    toState: fmtKr(r.totals.totalToState),
    company: fmtKr(r.totals.companyRetained + r.totals.providerFee),
    retained: fmtKr(r.totals.retainedForConsultant),
  })),
);
