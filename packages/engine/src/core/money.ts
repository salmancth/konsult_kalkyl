/** Money helpers. SEK is a plain number; rounding happens only at defined points. */

export function roundKr(x: number): number {
  // Avoid -0
  const r = Math.round(x);
  return r === 0 ? 0 : r;
}

/** Whole kronor, rounded DOWN (Skatteverket: "öretal bortfaller"). Never returns -0. */
export function floorKr(x: number): number {
  const r = Math.floor(x);
  return r === 0 ? 0 : r;
}

/** Taxable income is rounded DOWN to whole 100 kr. */
export function floorTo100(x: number): number {
  return Math.floor(x / 100) * 100;
}

/** Grundavdrag is rounded UP to whole 100 kr. */
export function ceilTo100(x: number): number {
  return Math.ceil(x / 100) * 100;
}

/**
 * Round to the nearest 100 kr; an amount ending in exactly 50 is rounded DOWN
 * (SKV 433 §7.4, allmän pensionsavgift).
 */
export function roundTo100HalfDown(x: number): number {
  return Math.ceil(x / 100 - 0.5) * 100;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Age at the START of the tax year (1 January), approximated from the birth year: a person born
 * in year B has turned `taxYear - B - 1` on 1 January of `taxYear` (born on 1 January: one more).
 * Skatteverket's age rules (66+, 67+, youth reduction) are all defined at the start of the year.
 */
export function ageAtYearStart(birthYear: number, taxYear: number): number {
  return taxYear - birthYear - 1;
}
