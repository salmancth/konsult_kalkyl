export interface SolveResult {
  x: number;
  /** 'ok' if f(x) ~ target; 'below' if target < f(lo) (x = lo); 'above' if target > f(hi) (x = hi). */
  status: 'ok' | 'below' | 'above';
  iterations: number;
}

/**
 * Monotone (non-decreasing) bisection: find x in [lo, hi] with f(x) = target.
 * Tolerance is on x (kr).
 */
export function solveIncreasing(
  f: (x: number) => number,
  target: number,
  lo: number,
  hi: number,
  tol = 0.01,
  maxIter = 200,
): SolveResult {
  if (f(lo) > target) return { x: lo, status: 'below', iterations: 0 };
  if (f(hi) < target) return { x: hi, status: 'above', iterations: 0 };
  let a = lo;
  let b = hi;
  let i = 0;
  while (b - a > tol && i < maxIter) {
    const mid = (a + b) / 2;
    if (f(mid) < target) a = mid;
    else b = mid;
    i++;
  }
  return { x: (a + b) / 2, status: 'ok', iterations: i };
}
