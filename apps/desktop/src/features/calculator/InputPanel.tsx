import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scenarios, type ScenarioId } from '@lyvan/engine';
import { formatKr } from '../../lib/format';
import { effectiveRevenue } from '../../state/model';
import { useApp } from '../../state/store';
import { useRules } from '../../state/useResults';
import { MunicipalityPicker } from './MunicipalityPicker';
import { NumberField } from './NumberField';
import { FieldLabel, ScenarioSettings } from './ScenarioSettings';

export function InputPanel() {
  const { t } = useTranslation();
  const inputs = useApp((s) => s.inputs);
  const setInputs = useApp((s) => s.setInputs);
  const rules = useRules();
  const [open, setOpen] = useState<ScenarioId | null>(null);

  return (
    <aside
      aria-label={t('input.common')}
      className="no-print w-80 shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <section>
        <FieldLabel htmlFor="revenue">{t('input.revenue')}</FieldLabel>
        <div className="mb-2 flex gap-3 text-sm" role="radiogroup" aria-label={t('input.revenue')}>
          {(['annual', 'hourly'] as const).map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" name="revenueMode" checked={inputs.revenueMode === m} onChange={() => setInputs({ revenueMode: m })} />
              {t(`input.${m}`)}
            </label>
          ))}
        </div>
        {inputs.revenueMode === 'annual' ? (
          <>
            <NumberField id="revenue" min={0} value={inputs.revenue} onCommit={(v) => setInputs({ revenue: v })} className="text-lg font-semibold" />
            <input
              type="range"
              aria-label={t('input.revenueSlider')}
              className="mt-2 w-full accent-accent"
              min={200_000}
              max={4_000_000}
              step={50_000}
              value={Math.min(4_000_000, Math.max(200_000, inputs.revenue))}
              onChange={(e) => setInputs({ revenue: Number(e.target.value) })}
            />
          </>
        ) : (
          <div className="space-y-2">
            <div>
              <FieldLabel htmlFor="hourlyRate">{t('input.hourlyRate')}</FieldLabel>
              <NumberField id="hourlyRate" min={0} value={inputs.hourlyRate} onCommit={(v) => setInputs({ hourlyRate: v })} />
            </div>
            <div>
              <FieldLabel htmlFor="hours">{t('input.hours')}</FieldLabel>
              <NumberField id="hours" kind="plain" min={0} max={10_000} value={inputs.hours} onCommit={(v) => setInputs({ hours: v })} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">= {formatKr(effectiveRevenue(inputs))}</p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('input.common')}</h2>
        <div>
          <FieldLabel htmlFor="overhead">{t('input.overhead')}</FieldLabel>
          <NumberField id="overhead" min={0} value={inputs.overhead} onCommit={(v) => setInputs({ overhead: v })} />
        </div>
        <MunicipalityPicker />
        <div>
          <FieldLabel htmlFor="birthYear">{t('input.birthYear')}</FieldLabel>
          <NumberField id="birthYear" kind="plain" min={1900} max={2100} value={inputs.birthYear} onCommit={(v) => setInputs({ birthYear: Math.round(v) })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inputs.churchMember} onChange={(e) => setInputs({ churchMember: e.target.checked })} />
          {t('input.church')}
        </label>
        <div>
          <FieldLabel htmlFor="taxYearDisplay">{t('input.taxYear')}</FieldLabel>
          <input id="taxYearDisplay" className="input" value={rules.year} readOnly aria-readonly="true" />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('input.scenarioSettings')}</h2>
        {scenarios.map((s) => (
          <div key={s.id} className="border-b border-slate-200 py-1 dark:border-slate-700">
            <button
              className="flex w-full items-center justify-between rounded py-1 text-left text-sm font-medium"
              aria-expanded={open === s.id}
              aria-controls={`panel-${s.id}`}
              onClick={() => setOpen(open === s.id ? null : s.id)}
            >
              {t(s.labelKey)}
              <span aria-hidden>{open === s.id ? '▾' : '▸'}</span>
            </button>
            {open === s.id && (
              <div id={`panel-${s.id}`} className="pb-2">
                <ScenarioSettings id={s.id} />
              </div>
            )}
          </div>
        ))}
      </section>
    </aside>
  );
}
