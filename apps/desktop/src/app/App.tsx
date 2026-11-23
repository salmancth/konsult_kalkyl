import { Suspense, lazy, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RulesBanner, StatusBars } from '../components/Banner';
import { Footer } from '../components/Footer';
import { OfferSheet } from '../components/OfferSheet';
import { PrintReport } from '../components/PrintReport';
import { InputPanel } from '../features/calculator/InputPanel';
import { Overview } from '../features/calculator/Overview';
import { OfferView } from '../features/offer/OfferView';
import { DetailDrawer } from '../features/detail/DetailDrawer';
import { SavedView } from '../features/saved/SavedView';
import { SettingsView } from '../features/settings/SettingsView';
import { csvFileName, resultsToCsv } from '../lib/export';
import { printPage, saveTextFile } from '../lib/platform';
import { useApp, type TabId } from '../state/store';
import { availableTaxYears, useResults } from '../state/useResults';
import { useTheme } from './useTheme';

// The chart views pull in Recharts (the bulk of the bundle): load them when first opened.
const CompareChart = lazy(() => import('../features/compare/CompareChart').then((m) => ({ default: m.CompareChart })));
const SweepChart = lazy(() => import('../features/sweep/SweepChart').then((m) => ({ default: m.SweepChart })));
const OptimizerView = lazy(() => import('../features/optimizer/OptimizerView').then((m) => ({ default: m.OptimizerView })));

const TABS: TabId[] = ['overview', 'offer', 'compare', 'sweep', 'optimizer', 'saved', 'settings'];

function Monogram() {
  return (
    <svg viewBox="0 0 512 512" className="h-8 w-8 shrink-0" aria-hidden>
      <rect width="512" height="512" rx="112" fill="#3BA7A0" />
      <path d="M168 120v236h196" fill="none" stroke="#1F2A44" strokeWidth="64" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tabs() {
  const { t } = useTranslation();
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (to: TabId): void => {
    setTab(to);
    refs.current[to]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const i = TABS.indexOf(tab);
    if (e.key === 'ArrowRight') move(TABS[(i + 1) % TABS.length]!);
    else if (e.key === 'ArrowLeft') move(TABS[(i - 1 + TABS.length) % TABS.length]!);
    else if (e.key === 'Home') move(TABS[0]!);
    else if (e.key === 'End') move(TABS[TABS.length - 1]!);
    else return;
    e.preventDefault();
  };

  return (
    <div role="tablist" aria-label={t('tabs.label')} className="no-print mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700" onKeyDown={onKeyDown}>
      {TABS.map((id) => (
        <button
          key={id}
          ref={(el) => {
            refs.current[id] = el;
          }}
          role="tab"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls="tabpanel"
          tabIndex={tab === id ? 0 : -1}
          onClick={() => setTab(id)}
          className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
            tab === id
              ? 'border-accent text-navy dark:text-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          {t(`tabs.${id}`)}
        </button>
      ))}
    </div>
  );
}

function TabPanel() {
  const { t } = useTranslation();
  const tab = useApp((s) => s.tab);
  return (
    <div role="tabpanel" id="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={-1}>
      <Suspense fallback={<p className="text-sm text-slate-500">{t('app.loading')}</p>}>
        {tab === 'overview' && <Overview />}
        {tab === 'offer' && <OfferView />}
        {tab === 'compare' && <CompareChart />}
        {tab === 'sweep' && <SweepChart />}
        {tab === 'optimizer' && <OptimizerView />}
        {tab === 'saved' && <SavedView />}
        {tab === 'settings' && <SettingsView />}
      </Suspense>
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  const language = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  const taxYear = useApp((s) => s.taxYear);
  const setTaxYear = useApp((s) => s.setTaxYear);
  const setTab = useApp((s) => s.setTab);
  const setNotice = useApp((s) => s.setNotice);
  const { results, revenue, rules } = useResults();

  const exportCsv = async (): Promise<void> => {
    try {
      const csv = resultsToCsv(results, {
        t: (key) => t(key),
        language,
        revenue,
        ruleSetId: rules.id,
        ruleSetVerified: rules.verified,
        disclaimer: t('app.disclaimer'),
      });
      const path = await saveTextFile(csvFileName(revenue), csv);
      if (path) setNotice({ kind: 'info', text: t('export.saved', { path }) });
    } catch (e) {
      setNotice({ kind: 'error', text: t('export.failed', { message: e instanceof Error ? e.message : String(e) }) });
    }
  };

  return (
    <header className="no-print flex flex-wrap items-center justify-between gap-3 bg-navy px-4 py-2 text-white">
      <div className="flex items-center gap-3">
        <Monogram />
        <div>
          <h1 className="text-base font-semibold leading-tight">{t('app.title')}</h1>
          <p className="text-xs text-white/80">{t('app.subtitle')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button className="btn-ghost" disabled={results.length === 0} onClick={() => void exportCsv()}>
          {t('export.csv')}
        </button>
        <button className="btn-ghost" disabled={results.length === 0} onClick={printPage}>
          {t('export.print')}
        </button>
        <label className="flex items-center gap-1">
          <span className="sr-only">{t('input.taxYear')}</span>
          <select className="btn-ghost bg-navy" value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))} aria-label={t('input.taxYear')}>
            {availableTaxYears().map((y) => (
              <option key={y} value={y} className="text-black">
                {t('input.taxYear')} {y}
              </option>
            ))}
          </select>
        </label>
        <div className="flex overflow-hidden rounded-md border border-white/30" role="group" aria-label={t('header.language')}>
          {(['sv', 'en'] as const).map((l) => (
            <button key={l} className={`px-2.5 py-1.5 uppercase ${language === l ? 'bg-white text-navy' : 'hover:bg-white/10'}`} aria-pressed={language === l} onClick={() => setLanguage(l)}>
              {l}
            </button>
          ))}
        </div>
        <button className="btn-ghost" aria-label={t('header.settings')} title={t('header.settings')} onClick={() => setTab('settings')}>
          ⚙
        </button>
      </div>
    </header>
  );
}

export function App() {
  const { t } = useTranslation();
  const hydrated = useApp((s) => s.hydrated);
  const theme = useApp((s) => s.theme);
  const detail = useApp((s) => s.detail);
  useTheme(theme);

  if (!hydrated) return <p className="p-6 text-slate-500">{t('app.loading')}</p>;

  return (
    <>
      {/* While the detail drawer (a modal dialog) is open the rest of the page is inert. */}
      <div className="flex h-full flex-col" inert={detail !== null}>
        <Header />
        <RulesBanner />
        <StatusBars />
        <div className="flex min-h-0 flex-1">
          <InputPanel />
          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            <Tabs />
            <TabPanel />
          </main>
        </div>
        <Footer />
      </div>
      <DetailDrawer />
      <PrintReport />
      <OfferSheet />
    </>
  );
}
