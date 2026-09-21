/**
 * Map filter state, shared by the FilterWidget UI, the MapLibre filter
 * expression (Map.svelte), and the JS predicate used to filter the ZIP panel.
 *
 * Operating status is not a filter: the build-time pipeline (process-data.mjs)
 * only emits Active operations, so every facility here is Active.
 */
import { SPECIES } from './species';
import type { FacilityProps } from './types';

export interface FilterState {
  /** Active animal-type keys. All keys = no type filter. */
  types: string[];
  /** Selected county, or null for all counties. */
  county: string | null;
  /** Minimum animal count (0 = no minimum). */
  minAnimals: number;
  /** Selected violation-type keys; empty = no violation filter. */
  violations: string[];
}

const ALL_TYPES = SPECIES.map((s) => s.key);

/**
 * Enforcement-history filters. Each maps to a count field on FacilityProps
 * (novs/lncs/orders/spills); a facility "has" the violation when that count
 * is > 0. Unlike the type toggles, an empty selection means no filter,
 * and a non-empty selection matches facilities with ANY of the chosen types.
 */
export const VIOLATION_TYPES: {
  key: keyof Pick<FacilityProps, 'novs' | 'lncs' | 'orders' | 'spills'>;
  label: string;
}[] = [
  { key: 'novs', label: 'Notices of violation' },
  { key: 'lncs', label: 'Letters of noncompliance' },
  { key: 'orders', label: 'Administrative orders' },
  { key: 'spills', label: 'Manure spills' }
];

export const defaultFilter = (): FilterState => ({
  types: [...ALL_TYPES],
  county: null,
  minAnimals: 0,
  violations: []
});

/** Minimum-animal-count presets for the widget. */
export const MIN_ANIMAL_PRESETS: { label: string; value: number }[] = [
  { label: 'Any size', value: 0 },
  { label: '1,000+', value: 1000 },
  { label: '5,000+', value: 5000 },
  { label: '20,000+', value: 20000 },
  { label: '100,000+', value: 100000 }
];

/** How many filter dimensions are currently narrowing the data (for a badge). */
export function activeCount(f: FilterState): number {
  let n = 0;
  if (f.types.length < ALL_TYPES.length) n++;
  if (f.county) n++;
  if (f.minAnimals > 0) n++;
  if (f.violations.length > 0) n++;
  return n;
}

/** MapLibre filter expression for the active filter, or null when unfiltered. */
export function toExpression(f: FilterState): unknown | null {
  const conds: unknown[] = [];
  if (f.types.length < ALL_TYPES.length) {
    conds.push(['in', ['get', 'type'], ['literal', f.types]]);
  }
  if (f.county) conds.push(['==', ['get', 'county'], f.county]);
  if (f.minAnimals > 0) conds.push(['>=', ['get', 'animals'], f.minAnimals]);
  if (f.violations.length) {
    // coalesce guards against null (unknown) counts, which would else error.
    conds.push([
      'any',
      ...f.violations.map((k) => ['>', ['coalesce', ['get', k], 0], 0])
    ]);
  }
  return conds.length ? ['all', ...conds] : null;
}

/** JS equivalent of the expression, for filtering the ZIP panel list. */
export function passes(p: FacilityProps, f: FilterState): boolean {
  if (f.types.length < ALL_TYPES.length && !f.types.includes(p.type)) return false;
  if (f.county && p.county !== f.county) return false;
  if (f.minAnimals > 0 && (p.animals || 0) < f.minAnimals) return false;
  if (f.violations.length && !f.violations.some((k) => ((p[k as keyof FacilityProps] as number) ?? 0) > 0))
    return false;
  return true;
}
