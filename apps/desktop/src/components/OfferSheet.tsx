import { useTranslation } from 'react-i18next';
import { getLocalities } from '@lyvan/rules';
import { computeOfferRowCached } from '../features/offer/computeOffer';
import { formatKr, formatKrTable, formatPct } from '../lib/format';
import { useApp } from '../state/store';
import { useRules } from '../state/useResults';

/**
 * One-page "payout offer" for the chosen scenario: what is billed, what the consultant receives per
 * month and where the rest goes. Invisible on screen; printed via the "Print offer sheet" button.
 */
export function OfferSheet() {
  const { t, i18n } = useTranslation();
  const inputs = useApp((s) => s.inputs);
  const taxYear = useApp((s) => s.taxYear);
  const rules = useRules();
  const row = computeOfferRowCached(inputs, taxYear, inputs.offerScenario);
  if (!row || row.status !== 'ok') return null;

  const { result } = row;
  const date = new Date().toLocaleDateString(i18n.language === 'sv' ? 'sv-SE' : 'en-GB');
  const municipality = getLocalities(rules.year)?.municipalities.find((m) => m.code === inputs.municipalityCode);
  const facts: [string, string][] = [
    [t('offer.sheet.billing'), `${formatKr(row.revenue)} ${t('offer.sheet.perYear')} (${formatKr(row.monthlyRevenue)} ${t('offer.sheet.perMonth')})`],
    ...(row.hourlyRate !== null ? [[t('offer.sheet.hourly', { hours: inputs.hours }), formatKr(row.hourlyRate)] as [string, string]] : []),
    [t('offer.sheet.netMonth'), formatKr(result.totals.netCash / 12)],
    [t('offer.sheet.netYear'), formatKr(result.totals.netCash)],
    [t('offer.sheet.pension'), formatKr(result.totals.pensionValue)],
    [t('offer.sheet.tax'), formatPct(result.totals.effectiveTaxRate)],
  ];
  const assumptions: [string, string][] = [
    ...(municipality ? [[t('input.municipality'), municipality.name] as [string, string]] : []),
    [t('input.municipalRate'), `${inputs.municipalRatePct.toFixed(2).replace('.', ',')} %`],
    [t('input.birthYear'), String(inputs.birthYear)],
    [t('input.church'), inputs.churchMember ? '✓' : '–'],
    [t('input.overhead'), formatKr(inputs.overhead)],
    [t('input.taxYear'), String(rules.year)],
    [t('print.ruleSet'), `${rules.id} (${t(rules.verified ? 'footer.verified' : 'footer.unverified')})`],
  ];

  return (
    <div className="print-only print-offer text-sm text-black">
      <header className="mb-4 border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold">LYVAN – {t('offer.sheet.title')}</h1>
        <p className="text-xs">
          {t(`scenario.${row.scenarioId}.label`)} · {t('print.generated')}: {date}
        </p>
      </header>

      <p className="mb-3 text-base">{t(`offer.sheet.headline_${inputs.targetMetric}`, { net: formatKr(inputs.targetMonthlyNet), scenario: t(`scenario.${row.scenarioId}.label`) })}</p>

      <table className="mb-4 w-full border-collapse text-base">
        <tbody>
          {facts.map(([k, v]) => (
            <tr key={k} className="border-b border-gray-300">
              <th scope="row" className="py-1 pr-4 text-left font-normal">
                {k}
              </th>
              <td className="py-1 text-right font-semibold tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-1 text-sm font-semibold">{t('offer.sheet.breakdown')}</h2>
      <table className="mb-4 w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-0.5">{t('detail.line')}</th>
            <th className="py-0.5 text-right">{t('offer.sheet.perYearCol')}</th>
            <th className="py-0.5 text-right">{t('offer.sheet.perMonthCol')}</th>
            <th className="py-0.5 text-right">{t('detail.pct')}</th>
          </tr>
        </thead>
        <tbody>
          {result.lines.map((l) => (
            <tr key={l.key} className={`border-b border-gray-200 ${l.kind === 'subtotal' ? 'italic text-gray-600' : ''} ${l.kind === 'payout' || l.kind === 'revenue' ? 'font-semibold' : ''}`}>
              <td className="py-0.5">{t(l.labelKey)}</td>
              <td className="py-0.5 text-right">{formatKrTable(l.amount)}</td>
              <td className="py-0.5 text-right">{formatKrTable(l.amount / 12)}</td>
              <td className="py-0.5 text-right">{formatPct(l.pctOfRevenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-1 text-sm font-semibold">{t('print.inputs')}</h2>
      <table className="mb-3 w-full border-collapse text-xs">
        <tbody>
          {assumptions.map(([k, v]) => (
            <tr key={k} className="border-b border-gray-200">
              <th scope="row" className="py-0.5 pr-4 text-left font-normal">
                {k}
              </th>
              <td className="py-0.5 text-right tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.warnings.length > 0 && (
        <ul className="mb-2 list-disc pl-4 text-xs">
          {result.warnings.map((w, k) => (
            <li key={`${w.code}-${k}`}>{t(`warning.${w.code}`, { ...w.params })}</li>
          ))}
        </ul>
      )}
      <p className="mb-2 text-xs text-gray-600">{t('offer.sheet.monthlyNote')}</p>
      <footer className="border-t border-black pt-1 text-xs">{t('app.disclaimer')}</footer>
    </div>
  );
}
