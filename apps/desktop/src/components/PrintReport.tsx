import { useTranslation } from 'react-i18next';
import { getLocalities } from '@lyvan/rules';
import { formatKr, formatKrTable, formatPct } from '../lib/format';
import { lineColorKey } from '../lib/colors';
import { useApp } from '../state/store';
import { useResults } from '../state/useResults';

/**
 * The print / "save as PDF" report. Invisible on screen; the print stylesheet hides the application
 * chrome and shows only this. Always includes the disclaimer and the rule-set status.
 */
export function PrintReport() {
  const { t, i18n } = useTranslation();
  const { results, revenue, rules } = useResults();
  const inputs = useApp((s) => s.inputs);
  const date = new Date().toLocaleDateString(i18n.language === 'sv' ? 'sv-SE' : 'en-GB');
  if (results.length === 0) return null;
  const municipality = getLocalities(rules.year)?.municipalities.find((m) => m.code === inputs.municipalityCode);

  const inputRows: [string, string][] = [
    [t('input.revenue'), formatKr(revenue)],
    [t('input.overhead'), formatKr(inputs.overhead)],
    ...(municipality ? [[t('input.municipality'), municipality.name] as [string, string]] : []),
    [t('input.municipalRate'), `${inputs.municipalRatePct.toFixed(2).replace('.', ',')} %`],
    [t('input.birthYear'), String(inputs.birthYear)],
    [t('input.church'), inputs.churchMember ? '✓' : '–'],
    [t('input.taxYear'), String(rules.year)],
    [t('print.ruleSet'), `${rules.id} (${t(rules.verified ? 'footer.verified' : 'footer.unverified')})`],
  ];

  return (
    <div className="print-only print-report text-xs text-black">
      <header className="mb-4 border-b border-black pb-2">
        <h1 className="text-lg font-bold">LYVAN Payout – {t('print.title')}</h1>
        <p>
          {t('print.generated')}: {date}
        </p>
      </header>

      <section className="mb-4">
        <h2 className="mb-1 text-sm font-semibold">{t('print.inputs')}</h2>
        <table className="w-full border-collapse">
          <tbody>
            {inputRows.map(([k, v]) => (
              <tr key={k} className="border-b border-gray-300">
                <th scope="row" className="py-0.5 pr-4 text-left font-normal">
                  {k}
                </th>
                <td className="py-0.5 text-right tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="mb-1 text-sm font-semibold">{t('print.scenarios')}</h2>
        <table className="w-full border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-0.5">{t('detail.line')}</th>
              <th className="py-0.5 text-right">{t('view.netCash')}</th>
              <th className="py-0.5 text-right">{t('card.ofRevenue')}</th>
              <th className="py-0.5 text-right">{t('card.pension')}</th>
              <th className="py-0.5 text-right">{t('card.toState')}</th>
              <th className="py-0.5 text-right">{t('card.company')}</th>
              <th className="py-0.5 text-right">{t('card.retained')}</th>
            </tr>
          </thead>
          <tbody>
            {[...results]
              .sort((a, b) => b.totals.netCash - a.totals.netCash)
              .map((r) => (
                <tr key={r.scenarioId} className="border-b border-gray-300">
                  <th scope="row" className="py-0.5 text-left font-medium">
                    {t(`scenario.${r.scenarioId}.label`)}
                  </th>
                  <td className="py-0.5 text-right">{formatKrTable(r.totals.netCash)}</td>
                  <td className="py-0.5 text-right">{formatPct(r.totals.netPctOfRevenue)}</td>
                  <td className="py-0.5 text-right">{formatKrTable(r.totals.pensionValue)}</td>
                  <td className="py-0.5 text-right">{formatKrTable(r.totals.totalToState)}</td>
                  <td className="py-0.5 text-right">{formatKrTable(r.totals.companyRetained + r.totals.providerFee)}</td>
                  <td className="py-0.5 text-right">{formatKrTable(r.totals.retainedForConsultant)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <h2 className="page-break mb-2 text-sm font-semibold">{t('print.perScenario')}</h2>
      {results.map((r, i) => (
        <section key={r.scenarioId} className={i > 0 ? 'page-break' : ''}>
          <h3 className="mb-1 text-sm font-semibold">{t(`scenario.${r.scenarioId}.label`)}</h3>
          <table className="mb-2 w-full border-collapse tabular-nums">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-0.5">{t('detail.line')}</th>
                <th className="py-0.5 text-right">{t('detail.amount')}</th>
                <th className="py-0.5 text-right">{t('detail.pct')}</th>
                <th className="py-0.5 pl-2">{t('detail.receiver')}</th>
                <th className="py-0.5 pl-2">{t('detail.formula')}</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => (
                <tr key={l.key} className={`border-b border-gray-200 align-top ${l.kind === 'subtotal' ? 'italic text-gray-600' : ''} ${l.kind === 'payout' || l.kind === 'revenue' ? 'font-semibold' : ''}`}>
                  <td className="py-0.5">{t(l.labelKey)}</td>
                  <td className="py-0.5 text-right">{formatKrTable(l.amount)}</td>
                  <td className="py-0.5 text-right">{formatPct(l.pctOfRevenue)}</td>
                  <td className="py-0.5 pl-2">{l.kind !== 'revenue' && l.kind !== 'subtotal' ? t(`party.${lineColorKey(l)}`) : ''}</td>
                  <td className="py-0.5 pl-2 text-gray-600">{l.formula ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.warnings.length > 0 && (
            <ul className="mb-1 list-disc pl-4">
              {r.warnings.map((w, k) => (
                <li key={`${w.code}-${k}`}>{t(`warning.${w.code}`, { ...w.params })}</li>
              ))}
            </ul>
          )}
          <ul className="list-disc pl-4 text-gray-600">
            {r.assumptions.map((a) => (
              <li key={a}>{t(a)}</li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="mt-4 border-t border-black pt-1">{t('app.disclaimer')}</footer>
    </div>
  );
}
