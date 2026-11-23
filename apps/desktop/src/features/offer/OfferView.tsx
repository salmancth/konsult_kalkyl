import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { scenarios, type ScenarioId } from '@lyvan/engine';
import { ScenarioFailures } from '../../components/ScenarioFailures';
import { SCENARIO_COLORS, readableTextOn } from '../../lib/colors';
import { formatKr, formatPct } from '../../lib/format';
import { printOfferSheet } from '../../lib/platform';
import { useApp } from '../../state/store';
import { useRules } from '../../state/useResults';
import { NumberField } from '../calculator/NumberField';
import { FieldLabel } from '../calculator/ScenarioSettings';
import { computeOfferCached } from './computeOffer';

const SCALE_FROM = 200_000;
const SCALE_TO = 4_000_000;

/**
 * Offer tool: turns the calculator around. "I want X kr net per month: what must I bill, in each
 * model, and which model gives most at which revenue?"
 */
export function OfferView() {
  const { t } = useTranslation();
  const inputs = useApp((s) => s.inputs);
  const taxYear = useApp((s) => s.taxYear);
  const setInputs = useApp((s) => s.setInputs);
  const setTab = useApp((s) => s.setTab);
  const rules = useRules();
  // Typing stays responsive: the (few hundred) calculations may lag one render behind the inputs.
  const deferred = useDeferredValue(inputs);
  const data = useMemo(() => computeOfferCached(deferred, taxYear), [deferred, taxYear]);
  const lowest = data.rows.find((r) => r.status === 'ok');
  const sheetRow = data.rows.find((r) => r.scenarioId === inputs.offerScenario);

  return (
    <div className="space-y-4">
      <ScenarioFailures failures={data.failures} />

      <section className="card p-4">
        <h2 className="font-semibold">{t('offer.title')}</h2>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t('offer.intro')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="targetNet">{t('offer.targetNet')}</FieldLabel>
            <NumberField id="targetNet" min={0} max={10_000_000} value={inputs.targetMonthlyNet} onCommit={(v) => setInputs({ targetMonthlyNet: v })} className="text-lg font-semibold" />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('offer.metric')}</legend>
            {(['netCash', 'consultantValue', 'totalValue'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="radio" name="targetMetric" checked={inputs.targetMetric === m} onChange={() => setInputs({ targetMetric: m })} />
                {t(`offer.metric_${m}`)}
              </label>
            ))}
            {inputs.targetMetric === 'totalValue' && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('offer.metricNote')}</p>}
          </fieldset>
          <div>
            <FieldLabel htmlFor="offerHours">{t('input.hours')}</FieldLabel>
            <NumberField id="offerHours" kind="plain" min={0} max={10_000} value={inputs.hours} onCommit={(v) => setInputs({ hours: v })} />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('offer.hoursHint')}</p>
          </div>
        </div>
      </section>

      <section className="card overflow-x-auto p-4" aria-labelledby="offer-need">
        <h2 id="offer-need" className="mb-2 font-semibold">
          {t('offer.needTitle', { target: formatKr(inputs.targetMonthlyNet) })}
        </h2>
        <table className="w-full min-w-[640px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-300 text-left dark:border-slate-600">
              <th className="py-1">{t('offer.col.scenario')}</th>
              <th className="py-1 text-right">{t('offer.col.perYear')}</th>
              <th className="py-1 text-right">{t('offer.col.perMonth')}</th>
              <th className="py-1 text-right">{t('offer.col.hourly')}</th>
              <th className="py-1 text-right">{t('offer.col.company')}</th>
              <th className="py-1 text-right">{t('offer.col.netMonth')}</th>
              <th className="py-1 text-right">{t('offer.col.taxShare')}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const ok = r.status === 'ok';
              return (
                <tr key={r.scenarioId} className="border-b border-slate-200 dark:border-slate-700">
                  <th scope="row" className="py-1.5 text-left font-medium">
                    <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: SCENARIO_COLORS[r.scenarioId] }} aria-hidden />
                    {t(`scenario.${r.scenarioId}.label`)}
                    {ok && r === lowest && (
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                        {t('offer.lowest')}
                      </span>
                    )}
                  </th>
                  {ok ? (
                    <>
                      <td className="py-1.5 text-right">{formatKr(r.revenue)}</td>
                      <td className="py-1.5 text-right">{formatKr(r.monthlyRevenue)}</td>
                      <td className="py-1.5 text-right">{r.hourlyRate === null ? '–' : formatKr(r.hourlyRate)}</td>
                      <td className="py-1.5 text-right">{formatKr(r.result.totals.companyRetained + r.result.totals.providerFee)}</td>
                      <td className="py-1.5 text-right">{formatKr(r.result.totals.netCash / 12)}</td>
                      <td className="py-1.5 text-right">{formatPct(r.result.totals.effectiveTaxRate)}</td>
                      <td className="py-1.5 pl-3 text-right">
                        <button
                          className="btn"
                          onClick={() => {
                            setInputs({ revenueMode: 'annual', revenue: r.revenue });
                            setTab('overview');
                          }}
                        >
                          {t('offer.open')}
                        </button>
                      </td>
                    </>
                  ) : (
                    <td colSpan={7} className="py-1.5 text-right text-slate-500 dark:text-slate-400">
                      {t('offer.unreachable')}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('offer.note', { year: rules.year })}</p>
      </section>

      <section className="card p-4" aria-labelledby="offer-bands">
        <h2 id="offer-bands" className="mb-1 font-semibold">
          {t('offer.bandsTitle')}
        </h2>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t('offer.bandsIntro', { metric: t(`offer.metric_${inputs.targetMetric}`).toLowerCase() })}</p>
        {data.bands.length === 0 ? (
          <p className="text-sm text-slate-500">{t('offer.noBands')}</p>
        ) : (
          <>
            <div className="flex h-9 w-full overflow-hidden rounded-md border border-slate-300 dark:border-slate-600" role="img" aria-label={t('offer.bandsTitle')}>
              {data.bands.map((b) => {
                const color = SCENARIO_COLORS[b.scenarioId];
                const width = ((Math.min(b.to, SCALE_TO) - Math.max(b.from, SCALE_FROM)) / (SCALE_TO - SCALE_FROM)) * 100;
                return (
                  <div
                    key={`${b.scenarioId}-${b.from}`}
                    className="flex items-center justify-center overflow-hidden whitespace-nowrap px-1 text-xs font-medium"
                    style={{ width: `${width}%`, background: color, color: readableTextOn(color) }}
                    title={`${t(`scenario.${b.scenarioId}.label`)}: ${formatKr(b.from)} – ${formatKr(b.to)}`}
                  >
                    {width > 12 ? t(`scenario.${b.scenarioId}.label`) : ''}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{formatKr(SCALE_FROM)}</span>
              <span>{formatKr(SCALE_TO)}</span>
            </div>
            <ul className="mt-3 space-y-0.5 text-sm tabular-nums">
              {data.bands.map((b) => (
                <li key={`${b.scenarioId}-${b.from}`}>
                  <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: SCENARIO_COLORS[b.scenarioId] }} aria-hidden />
                  {b.from === SCALE_FROM ? t('offer.upTo', { to: formatKr(b.to) }) : b.to === SCALE_TO ? t('offer.from', { from: formatKr(b.from) }) : `${formatKr(b.from)} – ${formatKr(b.to)}`}
                  : <strong>{t(`scenario.${b.scenarioId}.label`)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card p-4" aria-labelledby="offer-sheet">
        <h2 id="offer-sheet" className="mb-1 font-semibold">
          {t('offer.sheetTitle')}
        </h2>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t('offer.sheetIntro')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <FieldLabel htmlFor="offerScenario">{t('offer.sheetScenario')}</FieldLabel>
            <select id="offerScenario" className="input" value={inputs.offerScenario} onChange={(e) => setInputs({ offerScenario: e.target.value as ScenarioId })}>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" disabled={!sheetRow || sheetRow.status !== 'ok'} onClick={printOfferSheet}>
            {t('offer.printSheet')}
          </button>
        </div>
      </section>
    </div>
  );
}
