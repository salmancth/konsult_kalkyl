/**
 * Local tax rates per municipality (kommun + region), and church / burial fee averages per county.
 * Pure data + two lookup helpers. The data files (`se/localities-<year>.ts`) are generated from
 * Statistics Sweden (SCB) by `scripts/fetch-localities.mjs`.
 */

export interface Municipality {
  /** SCB municipality code, 4 digits (the first 2 are the county code). */
  code: string;
  name: string;
  /** County code, 2 digits. */
  county: string;
  /** Total municipal tax = kommun + region, percent of taxable income. */
  totalPct: number;
  municipalPct: number;
  regionalPct: number;
}

export interface County {
  code: string;
  name: string;
  /** Begravningsavgift (paid by everyone), percent of taxable income. */
  burialPct: number;
  /** Kyrkoavgift paid by members, INCLUDING the begravningsavgift. */
  churchInclBurialPct: number;
}

export interface LocalityData {
  year: number;
  source: string;
  national: { totalPct: number; burialPct: number; churchInclBurialPct: number };
  counties: County[];
  municipalities: Municipality[];
}

export interface LocalRates {
  municipality: Municipality;
  county: County;
  /** Fractions of taxable income (0.3082 = 30.82 %). */
  municipalTaxRate: number;
  burialFeeRate: number;
  /** Church fee EXCLUDING the burial fee (the engine adds the burial fee for everyone). */
  churchFeeRate: number;
}

const toRate = (pct: number): number => Math.round(pct * 100) / 10_000;

/** Look up the rates for a municipality code; undefined when the code is unknown. */
export function localRates(data: LocalityData, municipalityCode: string): LocalRates | undefined {
  const municipality = data.municipalities.find((m) => m.code === municipalityCode);
  if (!municipality) return undefined;
  const county = data.counties.find((c) => c.code === municipality.county);
  if (!county) return undefined;
  return {
    municipality,
    county,
    municipalTaxRate: toRate(municipality.totalPct),
    burialFeeRate: toRate(county.burialPct),
    // SCB's church figure includes the burial fee, which the engine charges separately.
    churchFeeRate: toRate(Math.max(0, county.churchInclBurialPct - county.burialPct)),
  };
}

/** Rates for the national average (used when no municipality is chosen). */
export function nationalRates(data: LocalityData): {
  municipalTaxRate: number;
  burialFeeRate: number;
  churchFeeRate: number;
} {
  const n = data.national;
  return {
    municipalTaxRate: toRate(n.totalPct),
    burialFeeRate: toRate(n.burialPct),
    churchFeeRate: toRate(Math.max(0, n.churchInclBurialPct - n.burialPct)),
  };
}
