import { useTranslation } from 'react-i18next';
import type { ScenarioFailure } from '@lyvan/engine';
import { uniqueFailureLines } from '../lib/inputErrors';
import { useApp } from '../state/store';

/** Lists scenarios whose settings failed validation, with a one-click way back to the defaults. */
export function ScenarioFailures({ failures }: { failures: ScenarioFailure[] }) {
  const { t } = useTranslation();
  const resetOptions = useApp((s) => s.resetOptions);
  if (failures.length === 0) return null;
  const groups = uniqueFailureLines(t, failures);
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
    >
      <h2 className="font-semibold">{t('overview.invalidScenarios')}</h2>
      <ul className="mt-1 list-disc pl-5">
        {groups.map((g) => (
          <li key={g.scenarioId}>
            <strong>{t(`scenario.${g.scenarioId}.label`)}</strong>
            {g.lines.length > 0 && <>: {g.lines.join('; ')}</>}
          </li>
        ))}
      </ul>
      <p className="mt-2">{t('error.fixOrReset')}</p>
      <button className="btn mt-2" onClick={resetOptions}>
        {t('error.resetOptions')}
      </button>
    </div>
  );
}
