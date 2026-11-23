import type { ScenarioResult } from '@lyvan/engine';
import type { Language } from '../state/model';

export interface CsvOptions {
  /** Translate a key (i18next `t`). Called for line labels, scenario labels and column headers. */
  t: (key: string) => string;
  language: Language;
  revenue: number;
  ruleSetId: string;
  ruleSetVerified: boolean;
  /** Translated disclaimer, written to every export. */
  disclaimer: string;
  generatedAt?: Date;
}

/** Swedish Excel expects ";" and decimal commas; English Excel expects "," and decimal points. */
function locale(language: Language): { sep: string; decimal: string } {
  return language === 'sv' ? { sep: ';', decimal: ',' } : { sep: ',', decimal: '.' };
}

/**
 * Text cells that start with = + - @ (or a tab/CR) are interpreted as formulas by spreadsheet
 * programs (CSV injection). Prefix them with an apostrophe so they stay text.
 */
export function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function cell(v: string | number, sep: string, isText: boolean): string {
  const s = isText ? safeText(String(v)) : String(v);
  return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of all lines of all scenarios. UTF-8 with BOM so Excel detects the encoding. */
export function resultsToCsv(results: ScenarioResult[], o: CsvOptions): string {
  const { sep, decimal } = locale(o.language);
  const text = (v: string): string => cell(v, sep, true);
  const raw = (v: number): string => cell(v, sep, false);
  const pct = (x: number): string => cell((x * 100).toFixed(2).replace('.', decimal), sep, false);
  const when = (o.generatedAt ?? new Date()).toISOString().slice(0, 10);

  const rows: string[] = [];
  rows.push([text('LYVAN Payout'), text(when)].join(sep));
  rows.push([text(o.t('export.col.revenue')), raw(Math.round(o.revenue))].join(sep));
  rows.push(
    [text(o.t('export.col.rules')), text(o.ruleSetId), text(o.t(o.ruleSetVerified ? 'footer.verified' : 'footer.unverified'))].join(sep),
  );
  rows.push(text(o.disclaimer));
  rows.push('');
  rows.push(
    ['scenario', 'line', 'amount', 'pct', 'receiver', 'kind', 'formula']
      .map((k) => text(o.t(`export.col.${k}`)))
      .join(sep),
  );
  for (const r of results) {
    for (const l of r.lines) {
      rows.push(
        [
          text(o.t(`scenario.${r.scenarioId}.label`)),
          text(o.t(l.labelKey)),
          raw(l.amount),
          pct(l.pctOfRevenue),
          text(o.t(`party.${l.party}`)),
          text(l.kind),
          text(l.formula ?? ''),
        ].join(sep),
      );
    }
    rows.push('');
  }
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

/** File name such as `lyvan-payout-1500000-2026-11-22.csv`. */
export function csvFileName(revenue: number, date = new Date()): string {
  return `lyvan-payout-${Math.round(revenue)}-${date.toISOString().slice(0, 10)}.csv`;
}
