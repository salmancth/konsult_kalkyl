import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { useRules } from '../state/useResults';

/** "Rules not verified" banner: shown while the active rule set is not fully verified. */
export function RulesBanner() {
  const { t } = useTranslation();
  const rules = useRules();
  if (rules.verified) return null;
  const items = rules.unverifiedItems.map((k) => t(`ruleItem.${k}`, { defaultValue: k })).join(', ');
  return (
    <div
      role="note"
      className="no-print border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <span aria-hidden>⚠ </span>
      {t('banner.unverified', { year: rules.year, items })}
    </div>
  );
}

/** Shown when the saved data could not be read, or a background save failed. */
export function StatusBars() {
  const { t } = useTranslation();
  const loadError = useApp((s) => s.loadError);
  const notice = useApp((s) => s.notice);
  const setNotice = useApp((s) => s.setNotice);
  // Confirmations fade away; errors stay until dismissed.
  useEffect(() => {
    if (notice?.kind !== 'info') return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice, setNotice]);
  return (
    <>
      {loadError && (
        <div role="alert" className="no-print border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">
          {t('error.loadFailed', { message: loadError })}
        </div>
      )}
      <div aria-live="polite" className="no-print">
        {notice && (
          <div
            className={`flex items-center justify-between border-b px-4 py-2 text-sm ${
              notice.kind === 'error'
                ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100'
            }`}
          >
            <span>{notice.text}</span>
            <button className="btn" onClick={() => setNotice(null)} aria-label={t('detail.close')}>
              ✕
            </button>
          </div>
        )}
      </div>
    </>
  );
}
