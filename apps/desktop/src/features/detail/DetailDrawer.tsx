import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_BALANCE_ADJUSTMENT, allocationSum, type ScenarioId, type ScenarioResult } from '@lyvan/engine';
import { PARTY_COLORS, lineColorKey, type ColorKey } from '../../lib/colors';
import { formatKr, formatKrTable, formatPct } from '../../lib/format';
import { useApp } from '../../state/store';
import { useResults } from '../../state/useResults';
import { ScenarioSettings } from '../calculator/ScenarioSettings';

const SEGMENTS: { key: ColorKey; value: (r: ScenarioResult) => number; label: string }[] = [
  { key: 'consultant', value: (r) => r.totals.netCash, label: 'view.netCash' },
  { key: 'pension', value: (r) => r.totals.pensionValue, label: 'party.pension' },
  { key: 'retained', value: (r) => r.totals.retainedForConsultant, label: 'party.retained' },
  { key: 'state', value: (r) => r.totals.totalToState, label: 'party.state' },
  { key: 'company', value: (r) => r.totals.companyRetained, label: 'party.company' },
  { key: 'provider', value: (r) => r.totals.providerFee, label: 'party.provider' },
  { key: 'external', value: (r) => r.totals.overhead, label: 'party.external' },
];

type Reconciliation = 'ok' | 'shortfall' | 'bad';

/**
 * "Reconciled" must mean more than "the lines sum to revenue" (the waterfall forces that): the
 * balancing line may only have absorbed rounding. A flagged result (budget too low, loss) may carry
 * a shortfall there, which is shown as such instead of being called reconciled.
 */
export function reconciliationStatus(result: ScenarioResult): Reconciliation {
  if (Math.abs(allocationSum(result) - result.totals.revenue) > 1) return 'bad';
  if (Math.abs(result.meta.balanceAdjustment) <= MAX_BALANCE_ADJUSTMENT) return 'ok';
  return result.warnings.some((w) => w.severity === 'error') ? 'shortfall' : 'bad';
}

function KronaBar({ result }: { result: ScenarioResult }) {
  const { t } = useTranslation();
  const parts = SEGMENTS.map((s) => ({ ...s, amount: Math.max(0, s.value(result)) })).filter((p) => p.amount > 0);
  const total = parts.reduce((s, p) => s + p.amount, 0);
  if (total <= 0) return null;
  const summary = parts.map((p) => `${t(p.label)} ${formatPct(p.amount / total)}`).join(', ');
  return (
    <section className="mb-4" aria-label={t('detail.whereKrona')}>
      <h3 className="mb-1 text-sm font-semibold">{t('detail.whereKrona')}</h3>
      <div className="flex h-5 w-full overflow-hidden rounded-md" role="img" aria-label={summary}>
        {parts.map((p) => (
          <div key={p.key} style={{ width: `${(p.amount / total) * 100}%`, background: PARTY_COLORS[p.key] }} title={`${t(p.label)}: ${formatKr(p.amount)}`} />
        ))}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PARTY_COLORS[p.key] }} />
            {t(p.label)} {formatPct(p.amount / total)}
          </li>
        ))}
      </ul>
    </section>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Drawer({ id, result, onClose }: { id: ScenarioId; result: ScenarioResult; onClose: () => void }) {
  const { t } = useTranslation();
  const panel = useRef<HTMLElement>(null);
  const status = reconciliationStatus(result);

  // Modal behaviour: remember the opener, keep Tab inside the dialog, give focus back on close.
  // The opener must be captured while rendering: once the page behind the dialog becomes `inert`
  // (same commit), the browser blurs it and `document.activeElement` is already <body> in an effect.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => opener?.focus?.();
  }, [opener]);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="no-print fixed inset-0 z-20 flex justify-end bg-black/40" onClick={onClose} onKeyDown={onKeyDown}>
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t(`scenario.${id}.label`)}
        className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{t(`scenario.${id}.label`)}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t(`scenario.${id}.description`)}</p>
          </div>
          <button className="btn shrink-0" data-autofocus onClick={onClose}>
            {t('detail.close')} (Esc)
          </button>
        </div>

        <p
          role="status"
          className={`mb-1 text-sm font-medium ${
            status === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : status === 'shortfall' ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
          }`}
        >
          {status === 'ok'
            ? t('detail.reconciled')
            : status === 'shortfall'
              ? t('detail.reconciledShortfall', { amount: result.meta.balanceAdjustment })
              : t('detail.notReconciled')}
        </p>
        {status === 'ok' && result.meta.balanceAdjustment !== 0 && (
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('detail.balance', { amount: result.meta.balanceAdjustment })}</p>
        )}
        <div className="mb-3" />

        <KronaBar result={result} />

        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
              <th className="py-1">{t('detail.line')}</th>
              <th className="py-1 text-right">{t('detail.amount')}</th>
              <th className="py-1 text-right">{t('detail.pct')}</th>
              <th className="py-1 pl-3">{t('detail.receiver')}</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l) => {
              const sub = l.kind === 'subtotal';
              const bold = l.kind === 'revenue' || l.kind === 'payout';
              return (
                <tr
                  key={l.key}
                  className={`border-b border-slate-100 align-top dark:border-slate-800 ${sub ? 'italic text-slate-500 dark:text-slate-400' : ''} ${bold ? 'font-semibold' : ''}`}
                >
                  <td className="py-1.5">
                    {t(l.labelKey)}
                    {l.formula && <div className="text-xs font-normal text-slate-500 dark:text-slate-400">{l.formula}</div>}
                  </td>
                  <td className="py-1.5 text-right">{formatKrTable(l.amount)}</td>
                  <td className="py-1.5 text-right">{formatPct(l.pctOfRevenue)}</td>
                  <td className="py-1.5 pl-3">
                    {l.kind !== 'revenue' && !sub && (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PARTY_COLORS[lineColorKey(l)] }} />
                        {t(`party.${lineColorKey(l)}`)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {result.warnings.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 font-semibold">{t('detail.warningsTitle')}</h3>
            <ul className="space-y-1 text-sm">
              {result.warnings.map((w, i) => (
                <li
                  key={`${w.code}-${i}`}
                  className={
                    w.severity === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : w.severity === 'warning'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-slate-600 dark:text-slate-300'
                  }
                >
                  <span aria-hidden>{w.severity === 'info' ? 'ℹ ' : '⚠ '}</span>
                  {t(`warning.${w.code}`, { ...w.params })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <h3 className="mb-1 font-semibold">{t('detail.assumptions')}</h3>
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
            {result.assumptions.map((a) => (
              <li key={a}>{t(a)}</li>
            ))}
          </ul>
        </div>

        <details className="mt-4 rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <summary className="cursor-pointer font-semibold">{t('detail.scenarioSettings')}</summary>
          <div className="mt-3">
            <ScenarioSettings id={id} idPrefix="drawer-" />
          </div>
        </details>
      </section>
    </div>
  );
}

export function DetailDrawer() {
  const id = useApp((s) => s.detail);
  const close = useApp((s) => s.openDetail);
  const { results } = useResults();
  const result = id ? results.find((r) => r.scenarioId === id) : undefined;
  if (!id || !result) return null;
  return <Drawer id={id} result={result} onClose={() => close(null)} />;
}
