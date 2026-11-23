import type { Line, ScenarioId } from '@lyvan/engine';

export const PARTY_COLORS = {
  consultant: '#2f9e6e',
  pension: '#3ba7a0',
  state: '#8a94a6',
  company: '#1f2a44',
  provider: '#e0a030',
  external: '#b8a58f',
  retained: '#8cc4ee',
} as const;

export type ColorKey = keyof typeof PARTY_COLORS;

/** Colour category of a waterfall line ('retained' kind overrides the party). */
export function lineColorKey(l: Line): ColorKey {
  return l.kind === 'retained' ? 'retained' : l.party;
}

export const SCENARIO_COLORS: Record<ScenarioId, string> = {
  salaried: '#64748b',
  'revenue-share': '#6366f1',
  umbrella: '#e0a030',
  'sole-trader': '#0ea5e9',
  'own-ab': '#2f9e6e',
};

/** Black or white text, whichever is readable on the given #rrggbb background (WCAG luminance). */
export function readableTextOn(hex: string): '#ffffff' | '#111827' {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast with white is 1.05 / (lum + 0.05); choose the better of white and near-black.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.07 ? '#ffffff' : '#111827';
}
