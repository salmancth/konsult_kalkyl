import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../calculator/NumberField';
import { FieldLabel } from '../calculator/ScenarioSettings';
import { useApp } from '../../state/store';
import { availableTaxYears, useRules } from '../../state/useResults';
import type { LyvanDefaults, Theme } from '../../state/model';

const DEFAULT_FIELDS: { key: keyof LyvanDefaults; max: number }[] = [
  { key: 'firmRetentionPct', max: 0.95 },
  { key: 'firmCutPct', max: 0.95 },
  { key: 'brokerFeePct', max: 0.5 },
  { key: 'providerFeePct', max: 0.2 },
];

export function SettingsView() {
  const { t } = useTranslation();
  const language = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const taxYear = useApp((s) => s.taxYear);
  const setTaxYear = useApp((s) => s.setTaxYear);
  const defaultPct = useApp((s) => s.defaultMunicipalPct);
  const setDefaultPct = useApp((s) => s.setDefaultMunicipalPct);
  const lyvanDefaults = useApp((s) => s.lyvanDefaults);
  const setLyvanDefault = useApp((s) => s.setLyvanDefault);
  const resetOptions = useApp((s) => s.resetOptions);
  const resetAll = useApp((s) => s.resetAll);
  const rules = useRules();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="card max-w-2xl space-y-6 p-4">
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="set-language">{t('settings.language')}</FieldLabel>
          <select id="set-language" className="input" value={language} onChange={(e) => setLanguage(e.target.value as 'sv' | 'en')}>
            <option value="sv">Svenska</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="set-theme">{t('settings.theme')}</FieldLabel>
          <select id="set-theme" className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            <option value="system">{t('settings.themeSystem')}</option>
            <option value="light">{t('settings.themeLight')}</option>
            <option value="dark">{t('settings.themeDark')}</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="set-year">{t('settings.taxYear')}</FieldLabel>
          <select id="set-year" className="input" value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))}>
            {availableTaxYears().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="set-municipal">{t('settings.defaultMunicipal')}</FieldLabel>
          <NumberField id="set-municipal" kind="plain" decimals={2} min={25} max={40} value={defaultPct} onCommit={setDefaultPct} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-semibold">{t('settings.lyvanDefaults')}</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{t('settings.lyvanDefaultsHelp')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {DEFAULT_FIELDS.map((f) => (
            <div key={f.key}>
              <FieldLabel htmlFor={`set-${f.key}`}>{t(`settings.${f.key}`)}</FieldLabel>
              <NumberField id={`set-${f.key}`} kind="pct" decimals={1} min={0} max={f.max} value={lyvanDefaults[f.key]} onCommit={(v) => setLyvanDefault(f.key, v)} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn" onClick={resetOptions}>
            {t('settings.resetOptions')}
          </button>
          {confirmReset ? (
            <span role="alert" className="inline-flex items-center gap-2 text-sm">
              {t('settings.resetAllConfirm')}
              <button
                className="btn border-red-500 text-red-700 dark:text-red-300"
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                }}
              >
                {t('settings.reset')}
              </button>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                {t('saved.cancel')}
              </button>
            </span>
          ) : (
            <button className="btn" onClick={() => setConfirmReset(true)}>
              {t('settings.resetAll')}
            </button>
          )}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
        <h2 className="mb-1 font-semibold">{t('settings.rules')}</h2>
        <p>{t('settings.rulesStatus', { id: rules.id, status: t(rules.verified ? 'settings.rulesVerified' : 'settings.rulesUnverified') })}</p>
        {rules.unverifiedItems.length > 0 && (
          <>
            <h3 className="mt-2 font-medium">{t('settings.unverifiedItems')}</h3>
            <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300">
              {rules.unverifiedItems.map((k) => (
                <li key={k}>{t(`ruleItem.${k}`, { defaultValue: k })}</li>
              ))}
            </ul>
          </>
        )}
        <h3 className="mt-2 font-medium">{t('settings.sources')}</h3>
        <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300">
          {rules.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('settings.about')}</h2>
        <p>
          LYVAN Payout – {t('settings.version', { version: __APP_VERSION__ })}
        </p>
        <p className="mt-1">{t('settings.dataLocation')}</p>
        <p className="mt-2">{t('app.disclaimer')}</p>
      </section>
    </div>
  );
}
