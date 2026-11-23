import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScenarioResult } from '@lyvan/engine';
import { ScenarioFailures } from '../../components/ScenarioFailures';
import { SCENARIO_COLORS, readableTextOn } from '../../lib/colors';
import { formatKr, formatPct } from '../../lib/format';
import { useApp } from '../../state/store';
import { useResults } from '../../state/useResults';

export type Metric = 'netCash' | 'consultantValue' | 'companyMargin';

export function metricValue(r: ScenarioResult, m: Metric): number {
  switch (m) {
    case 'netCash':
      return r.totals.netCash;
    case 'consultantValue':
      return r.totals.consultantValue;
    case 'companyMargin':
      return r.totals.companyRetained + r.totals.providerFee;
  }
}

function ScenarioCard({ r, rank, metric, div, revenue }: { r: ScenarioResult; rank: number; metric: Metric; div: number; revenue: number }) {
  const { t } = useTranslation();
  const openDetail = useApp((s) => s.openDetail);
  const titleId = useId();
  const warn = r.warnings.filter((w) => w.severity !== 'info').length;
  const value = metricValue(r, metric);
  const color = SCENARIO_COLORS[r.scenarioId];
  return (
    <button
      onClick={() => openDetail(r.scenarioId)}
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-values`}
      className="card p-4 text-left transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: color, color: readableTextOn(color) }}>
          {t('card.rank', { n: rank })}
        </span>
        <span id={titleId} className="font-semibold">
          {t(`scenario.${r.scenarioId}.label`)}
        </span>
      </div>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t(`scenario.${r.scenarioId}.description`)}</p>
      <div id={`${titleId}-values`}>
        <div className="text-2xl font-bold tabular-nums">{formatKr(value / div)}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {formatPct(revenue > 0 ? value / revenue : 0)} {t('card.ofRevenue')}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
          <dt className="text-slate-500 dark:text-slate-400">{t('card.pension')}</dt>
          <dd className="text-right">+{formatKr(r.totals.pensionValue / div)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">{t('card.toState')}</dt>
          <dd className="text-right">{formatKr(r.totals.totalToState / div)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">{t('card.company')}</dt>
          <dd className="text-right">{formatKr((r.totals.companyRetained + r.totals.providerFee) / div)}</dd>
          {r.totals.retainedForConsultant !== 0 && (
            <>
              <dt className="text-slate-500 dark:text-slate-400">{t('card.retained')}</dt>
              <dd className="text-right">{formatKr(r.totals.retainedForConsultant / div)}</dd>
            </>
          )}
        </dl>
        {warn > 0 && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">⚠ {t('card.warnings', { count: warn })}</p>}
      </div>
    </button>
  );
}

export function Overview() {
  const { t } = useTranslation();
  const { results, failures, revenue, error } = useResults();
  const [metric, setMetric] = useState<Metric>('netCash');
  const [monthly, setMonthly] = useState(false);
  const div = monthly ? 12 : 1;

  const ranked = useMemo(
    () => [...results].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [results, metric],
  );

  if (error) return <p role="alert" className="text-red-700 dark:text-red-300">{t('error.unexpected', { message: error })}</p>;

  return (
    <div>
      <ScenarioFailures failures={failures} />
      <div className="no-print mb-4 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          {t('view.metric')}
          <select className="input w-auto" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="netCash">{t('view.netCash')}</option>
            <option value="consultantValue">{t('view.consultantValue')}</option>
            <option value="companyMargin">{t('view.companyMargin')}</option>
          </select>
        </label>
        <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600" role="group" aria-label={t('view.period')}>
          {[false, true].map((m) => (
            <button
              key={String(m)}
              className={`px-3 py-1.5 ${monthly === m ? 'bg-navy text-white' : 'bg-white dark:bg-slate-800'}`}
              onClick={() => setMonthly(m)}
              aria-pressed={monthly === m}
            >
              {t(m ? 'view.monthly' : 'view.annual')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranked.map((r, i) => (
          <ScenarioCard key={r.scenarioId} r={r} rank={i + 1} metric={metric} div={div} revenue={revenue} />
        ))}
      </div>

      {ranked.length > 0 && (
        <details className="card mt-4 p-4 text-sm">
          <summary className="cursor-pointer font-semibold">{t('overview.assumptions')}</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {ranked.map((r) => (
              <section key={r.scenarioId}>
                <h3 className="mb-1 font-medium">{t(`scenario.${r.scenarioId}.label`)}</h3>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300">
                  {r.assumptions.map((a) => (
                    <li key={a}>{t(a)}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
