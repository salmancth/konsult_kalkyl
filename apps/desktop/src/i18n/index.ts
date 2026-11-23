import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { formatKr } from '../lib/format';
import en from './en.json';
import sv from './sv.json';

export type Language = 'sv' | 'en';

/** `{{income, kr}}` -> "660 400 kr"; `{{maxPct, pct}}` -> "30 %". */
function addFormatters(): void {
  const f = i18n.services.formatter;
  if (!f) return;
  f.add('kr', (value) => formatKr(Number(value)));
  f.add('pct', (value) => `${Math.round(Number(value) * 1000) / 10} %`.replace('.', ','));
}

/** Resolves when i18n is ready; `main.tsx` awaits it before rendering. */
export const i18nReady: Promise<unknown> = i18n
  .use(initReactI18next)
  .init({
    resources: { sv: { translation: sv }, en: { translation: en } },
    lng: 'sv',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
  .then(() => {
    addFormatters();
  });

addFormatters();

export default i18n;
