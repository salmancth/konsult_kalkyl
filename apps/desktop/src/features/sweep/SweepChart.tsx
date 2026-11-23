import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { scenarios } from '@lyvan/engine';
import { ScenarioFailures } from '../../components/ScenarioFailures';
import { SCENARIO_COLORS } from '../../lib/colors';
import { formatKr } from '../../lib/format';
import { useApp } from '../../state/store';
import { useResults } from '../../state/useResults';
import { computeSweepCached } from './computeSweep';

export function SweepChart() {
  const { t } = useTranslation();
  const inputs = useApp((s) => s.inputs);
  const taxYear = useApp((s) => s.taxYear);
  const { revenue } = useResults();
  // Keep typing responsive: the sweep (140+ calculations) may lag one render behind the inputs.
  const deferred = useDeferredValue(inputs);
  const { rows, crossovers, failures, ids } = useMemo(() => computeSweepCached(deferred, taxYear), [deferred, taxYear]);

  return (
    <div className="card p-4">
      <ScenarioFailures failures={failures} />
      <h2 className="mb-2 font-semibold">{t('sweep.title')}</h2>
      <div className="text-slate-700 dark:text-slate-300" style={{ width: '100%', height: 440 }} role="img" aria-label={t('sweep.title')}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="revenue"
              type="number"
              domain={[300_000, 3_000_000]}
              tick={{ fill: 'currentColor' }}
              tickFormatter={(v: number) => `${String(v / 1_000_000).replace('.', ',')} M`}
            />
            <YAxis tick={{ fill: 'currentColor' }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} />
            <Tooltip formatter={(v) => formatKr(Number(v))} labelFormatter={(l) => `${t('sweep.revenue')}: ${formatKr(Number(l))}`} />
            <Legend />
            {scenarios
              .filter((s) => ids.includes(s.id))
              .map((s) => (
                <Line key={s.id} type="monotone" dataKey={s.id} name={t(s.labelKey)} stroke={SCENARIO_COLORS[s.id]} dot={false} strokeWidth={2} isAnimationActive={false} />
              ))}
            {revenue >= 300_000 && revenue <= 3_000_000 && (
              <ReferenceLine x={revenue} stroke="#64748b" strokeDasharray="4 4" label={{ value: t('sweep.yourRevenue'), fill: 'currentColor', fontSize: 11, position: 'insideTopRight' }} />
            )}
            {crossovers.map((c) => (
              <ReferenceDot key={`${c.id}-${c.x}`} x={c.x} y={c.y} r={5} fill={SCENARIO_COLORS[c.id]} stroke="white" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {crossovers.length > 0 && (
        <ul className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          {crossovers.map((c) => (
            <li key={`${c.id}-${c.x}`}>
              {formatKr(c.x)}: {t('sweep.crossover', { scenario: t(`scenario.${c.id}.label`) })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
