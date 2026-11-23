/** Plain-text formatting for formula strings (no Intl dependency, deterministic). */

export function fmtKr(x: number): string {
  const sign = x < 0 && Math.round(Math.abs(x)) !== 0 ? '-' : '';
  const s = Math.round(Math.abs(x)).toString();
  const withSpaces = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${withSpaces}`;
}

/** Percent with up to `decimals` decimals; trailing zeros after the decimal point are dropped. */
export function fmtPct(x: number, decimals = 2): string {
  const raw = (x * 100).toFixed(decimals);
  // Only strip zeros that belong to the fraction ("20.00" -> "20", but "100" stays "100").
  const s = raw.includes('.') ? raw.replace(/\.?0+$/, '') : raw;
  return `${s === '-0' ? '0' : s}%`;
}
