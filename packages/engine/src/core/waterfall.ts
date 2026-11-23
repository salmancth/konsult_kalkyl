import { roundKr } from './money';
import { NON_ALLOCATION_KINDS, type Line, type LineKind, type Party } from '../types';

interface RawLine {
  key: string;
  amount: number;
  party: Party;
  kind: LineKind;
  formula?: string;
}

export interface AddOptions {
  formula?: string;
  /** Drop the line if the rounded amount is zero. */
  hideIfZero?: boolean;
}

/**
 * Builds an ordered waterfall that reconciles exactly to revenue.
 * Allocation lines (everything except 'revenue' and 'subtotal') must sum to revenue; the rounding
 * residual is absorbed into the line identified by `balanceKey`.
 */
export class Waterfall {
  private readonly raw: RawLine[] = [];

  constructor(
    private readonly revenue: number,
    private readonly balanceKey: string,
  ) {
    this.raw.push({ key: 'revenue', amount: roundKr(revenue), party: 'consultant', kind: 'revenue' });
  }

  add(key: string, amount: number, party: Party, kind: LineKind, opts: AddOptions = {}): this {
    const rounded = roundKr(amount);
    if (opts.hideIfZero && rounded === 0) return this;
    const line: RawLine = { key, amount: rounded, party, kind };
    if (opts.formula !== undefined) line.formula = opts.formula;
    this.raw.push(line);
    return this;
  }

  subtotal(key: string, amount: number, party: Party, formula?: string): this {
    const line: RawLine = { key, amount: roundKr(amount), party, kind: 'subtotal' };
    if (formula !== undefined) line.formula = formula;
    this.raw.push(line);
    return this;
  }

  finish(): { lines: Line[]; balanceAdjustment: number } {
    const revenue = roundKr(this.revenue);
    const sum = this.raw
      .filter((l) => !NON_ALLOCATION_KINDS.has(l.kind))
      .reduce((s, l) => s + l.amount, 0);
    const residual = revenue - sum;
    const target = this.raw.find((l) => l.key === this.balanceKey);
    if (!target) {
      throw new Error(`Waterfall: balance line '${this.balanceKey}' not found`);
    }
    target.amount += residual;
    const lines: Line[] = this.raw.map((l) => {
      const line: Line = {
        key: l.key,
        labelKey: `line.${l.key}`,
        amount: l.amount,
        party: l.party,
        kind: l.kind,
        pctOfRevenue: revenue === 0 ? 0 : l.amount / revenue,
      };
      if (l.formula !== undefined) line.formula = l.formula;
      return line;
    });
    return { lines, balanceAdjustment: residual };
  }
}
