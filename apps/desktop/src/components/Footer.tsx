import { useTranslation } from 'react-i18next';
import { useRules } from '../state/useResults';

export function Footer() {
  const { t } = useTranslation();
  const rules = useRules();
  return (
    <footer className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <span>{t('app.disclaimer')}</span>
      <span>
        {t('footer.rules', { id: rules.id })} · {t(rules.verified ? 'footer.verified' : 'footer.unverified')} · v{__APP_VERSION__}
      </span>
    </footer>
  );
}
