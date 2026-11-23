import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Totals } from '@lyvan/engine';
import { ScenarioFailures } from '../../components/ScenarioFailures';
import { PARTY_COLORS, type ColorKey } from '../../lib/colors';
import { formatKr } from '../../lib/format';
import { useResults } from '../../state/useResults';

const SEGMENTS: { key: ColorKey; pick: (t: Totals) => number }[] = [
  { key: 'consultant', pick: (t) => t.netCash },
  { key: 'pension', pick: (t) => t.pensionValue },
  { key: 'retained', pick: (t) => t.retainedForConsultant },
  { key: 'state', pick: (t) => t.totalToState },
  { key: 'company', pick: (t) => t.companyRetained },
  { key: 'provider', pick: (t) => t.providerFee },
  { key: 'external', pick: (t) => t.overhead },
];

const SEGMENT_LABEL: Record<ColorKey, string> = {
  consultant: 'view.netCash',
  pension: 'party.pension',
  retained: 'party.retained',
  state: 'party.state',
  company: 'party.company',
  provider: 'party.provider',
  external: 'party.external',
};

type Mode = 'percent' | 'kronor';

export function CompareChart() {
  const { t } = useTranslation();
  const { results, failures, error } = useResults();
  const [mode, setMode] = useState<Mode>('percent');

  const data = useMemo(
    () =>
      results.map((r) => {
        const row: Record<string, string | number> = { name: t(`scenario.${r.scenarioId}.label`) };
        // Negative parts (a loss carried in a balancing line) cannot be drawn in a stack.
        for (const s of SEGMENTS) row[s.key] = Math.max(0, s.pick(r.totals));
        return row;
      }),
    [results, t],
  );

  if (error) return <p role="alert" className="text-red-700 dark:text-red-300">{t('error.unexpected', { message: error })}</p>;

  return (
    <div className="card p-4">
      <ScenarioFailures failures={failures} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t('compare.title')}</h2>
        <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm dark:border-slate-600" role="group" aria-label={t('compare.mode')}>
          {(['percent', 'kronor'] as const).map((m) => (
            <button
              key={m}
              className={`px-3 py-1.5 ${mode === m ? 'bg-navy text-white' : 'bg-white dark:bg-slate-800'}`}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {t(`compare.${m}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="text-slate-700 dark:text-slate-300" style={{ width: '100%', height: 420 }} role="img" aria-label={t('compare.title')}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" stackOffset={mode === 'percent' ? 'expand' : 'none'} margin={{ left: 40, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(v: number) => (mode === 'percent' ? `${Math.round(v * 100)} %` : `${Math.round(v / 1000)} k`)}
            />
            <YAxis type="category" dataKey="name" width={190} tick={{ fill: 'currentColor' }} />
            <Tooltip formatter={(v) => formatKr(Number(v))} />
            <Legend />
            {SEGMENTS.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={t(SEGMENT_LABEL[s.key])} stackId="a" fill={PARTY_COLORS[s.key]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer">{t('compare.table')}</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="border-b border-slate-300 text-left dark:border-slate-600">
              <th className="py-1">{t('detail.line')}</th>
              {SEGMENTS.map((s) => (
                <th key={s.key} className="py-1 text-right">
                  {t(SEGMENT_LABEL[s.key])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={String(row.name)} className="border-b border-slate-100 dark:border-slate-800">
                <th scope="row" className="py-1 text-left font-medium">
                  {row.name}
                </th>
                {SEGMENTS.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {formatKr(Number(row[s.key]), false)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
