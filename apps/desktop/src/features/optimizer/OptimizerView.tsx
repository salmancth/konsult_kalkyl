import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EngineInputError, getScenario, optimize, type OptimizeResult, type ScenarioFailure } from '@lyvan/engine';
import { ScenarioFailures } from '../../components/ScenarioFailures';
import { formatKr } from '../../lib/format';
import { toCommonInput } from '../../state/model';
import { useApp } from '../../state/store';
import { useRules } from '../../state/useResults';
import { NumberField } from '../calculator/NumberField';

type Outcome = { ok: true; res: OptimizeResult } | { ok: false; failures: ScenarioFailure[] };

export function OptimizerView() {
  const { t } = useTranslation();
  const inputs = useApp((s) => s.inputs);
  const setOption = useApp((s) => s.setOption);
  const rules = useRules();
  const deferred = useDeferredValue(inputs);

  const defaults = getScenario('own-ab').defaults(rules) as { pensionWeight: number; retainedWeight: number };
  const stored = (inputs.options['own-ab'] ?? {}) as Partial<typeof defaults>;
  const pw = stored.pensionWeight ?? defaults.pensionWeight;
  const rw = stored.retainedWeight ?? defaults.retainedWeight;

  const outcome = useMemo((): Outcome => {
    try {
      // The weights live in the own-AB options, so the "Optimize" strategy and this view agree.
      const res = optimize('own-ab', { common: toCommonInput(deferred, rules.year), options: { ...(deferred.options['own-ab'] ?? {}) } }, rules);
      return { ok: true, res };
    } catch (e) {
      if (!(e instanceof EngineInputError)) throw e;
      return { ok: false, failures: [{ scenarioId: 'own-ab', issues: e.issues, scope: e.scope }] };
    }
  }, [deferred, rules]);

  if (!outcome.ok) return <ScenarioFailures failures={outcome.failures} />;
  const { res } = outcome;
  const totals = res.result.totals;

  return (
    <div className="card space-y-4 p-4">
      <h2 className="font-semibold">{t('optimizer.title')}</h2>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <div>
          <label htmlFor="opt-pw" className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            {t('optimizer.pensionWeight')}
          </label>
          <NumberField id="opt-pw" kind="plain" decimals={2} min={0} max={1.5} className="w-24" value={pw} onCommit={(v) => setOption('own-ab', 'pensionWeight', v)} />
        </div>
        <div>
          <label htmlFor="opt-rw" className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            {t('optimizer.retainedWeight')}
          </label>
          <NumberField id="opt-rw" kind="plain" decimals={2} min={0} max={1.5} className="w-24" value={rw} onCommit={(v) => setOption('own-ab', 'retainedWeight', v)} />
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setOption('own-ab', 'salaryStrategy', 'custom');
            setOption('own-ab', 'customSalary', res.salary);
          }}
        >
          {t('optimizer.apply')}
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('optimizer.weightsHelp')}</p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tabular-nums md:grid-cols-5">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('optimizer.best')}</dt>
          <dd className="font-semibold">{formatKr(res.salary)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('optimizer.netCashAtBest')}</dt>
          <dd>{formatKr(totals.netCash)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('optimizer.pensionAtBest')}</dt>
          <dd>{formatKr(totals.pensionValue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('optimizer.retainedAtBest')}</dt>
          <dd>{formatKr(totals.retainedForConsultant)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('optimizer.maxSalary')}</dt>
          <dd>{formatKr(res.maxSalary)}</dd>
        </div>
      </dl>

      <div className="text-slate-700 dark:text-slate-300" style={{ width: '100%', height: 420 }} role="img" aria-label={t('optimizer.title')}>
        <ResponsiveContainer>
          <LineChart data={res.curve} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="salary" type="number" domain={[0, 'dataMax']} tick={{ fill: 'currentColor' }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} />
            <YAxis tick={{ fill: 'currentColor' }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} />
            <Tooltip formatter={(v) => formatKr(Number(v))} labelFormatter={(l) => `${t('optimizer.salary')}: ${formatKr(Number(l))}`} />
            <Legend />
            <Line type="monotone" dataKey="netCash" name={t('view.netCash')} stroke="#2f9e6e" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="objective" name={t('optimizer.objective')} stroke="#3ba7a0" dot={false} strokeWidth={2} strokeDasharray="6 3" isAnimationActive={false} />
            <ReferenceDot x={res.salary} y={res.objective} r={6} fill="#e0a030" stroke="white" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
