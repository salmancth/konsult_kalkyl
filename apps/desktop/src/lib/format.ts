/** Formatting + parsing helpers (sv-SE). */

const krFmt = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/** Round to whole kronor and never produce "-0". */
function wholeKr(n: number): number {
  const r = Math.round(n);
  return r === 0 ? 0 : r;
}

export function formatKr(n: number, withUnit = true): string {
  const s = krFmt.format(wholeKr(n)).replace('\u2212', '-');
  return withUnit ? `${s} kr` : s;
}

/** Negative numbers in parentheses for tables. */
export function formatKrTable(n: number): string {
  const v = wholeKr(n);
  return v < 0 ? `(${krFmt.format(-v)})` : krFmt.format(v);
}

/** Percent with a decimal comma: 0.523 -> "52,3 %". Never "-0,0 %". */
export function formatPct(x: number, decimals = 1): string {
  const fixed = (x * 100).toFixed(decimals);
  const s = Number(fixed) === 0 ? (0).toFixed(decimals) : fixed;
  return `${s.replace('.', ',')} %`;
}

const MULTIPLIER = /^(.*?)(mkr|mnkr|msek|m|tkr|ksek|kkr|k)?(?:kr|sek|:-)?$/;

function multiplierOf(suffix: string | undefined): number {
  if (!suffix) return 1;
  return suffix.startsWith('m') ? 1_000_000 : 1_000;
}

/**
 * Parse the numeric part. Rules (Swedish conventions):
 * - repeated separators are thousands separators: "1.500.000", "1,500,000";
 * - with both kinds, the LAST one is the decimal separator: "1.234,56", "1,234.56";
 * - a single "," is a decimal comma: "1,5";
 * - a single "." is a decimal point ("1.5"), except "1.500" without a multiplier, which is 1 500.
 */
function parseNumberBody(raw: string, hasMultiplier: boolean): number | null {
  if (!/^-?[\d.,]+$/.test(raw) || !/\d/.test(raw)) return null;
  const negative = raw.startsWith('-');
  const b = negative ? raw.slice(1) : raw;
  const dots = (b.match(/\./g) ?? []).length;
  const commas = (b.match(/,/g) ?? []).length;
  let normalized: string;
  if (dots > 0 && commas > 0) {
    const decimal = b.lastIndexOf('.') > b.lastIndexOf(',') ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    if (b.indexOf(decimal) !== b.lastIndexOf(decimal)) return null;
    const [intPart = '', fracPart = ''] = b.split(decimal);
    if (!/^\d{1,3}(?:\D\d{3})*$/.test(intPart) || intPart.includes(decimal)) return null;
    normalized = `${intPart.split(thousands).join('')}.${fracPart}`;
  } else if (dots > 1 || commas > 1) {
    if (!/^\d{1,3}(?:[.,]\d{3})+$/.test(b)) return null;
    normalized = b.replace(/[.,]/g, '');
  } else if (dots === 1 && !hasMultiplier && /^\d{1,3}\.\d{3}$/.test(b)) {
    normalized = b.replace('.', '');
  } else {
    normalized = b.replace(',', '.');
  }
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

/**
 * Parse user amounts: "1500000", "1 500 000", "1,5M", "1.5m", "750k", "750 tkr", "1,5 mkr".
 * Returns null when the text is not a number.
 */
export function parseAmount(text: string): number | null {
  const s = text
    .toLowerCase()
    .replace(/[\s\u00A0\u202F_']/g, '')
    .replace(/\u2212/g, '-');
  if (s === '') return null;
  const m = MULTIPLIER.exec(s);
  if (!m) return null;
  const body = parseNumberBody(m[1] ?? '', m[2] !== undefined);
  if (body === null) return null;
  const n = body * multiplierOf(m[2]);
  return Number.isFinite(n) ? n : null;
}
