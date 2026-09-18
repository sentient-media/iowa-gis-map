/** Shared data shapes for the CAFO map. */

/** Properties carried on each GeoJSON facility feature (see process-data.mjs). */
export interface FacilityProps {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  type: string; // raw AnimalType key
  animals: number; // estimated head count
  units: number; // animal units
  breakdown: string; // per-species AU breakdown, preformatted
  manure: number; // est. annual lbs
  status: string; // opStatus
  optype: string; // OperatType
  // Permits — 'Y' | 'N' | ''
  cons: string;
  npdes: string;
  mmp: string;
  pindexMmp: string;
  nmp: string;
  // Enforcement history — count or null (unknown)
  novs: number | null;
  lastNov: string;
  lncs: number | null;
  orders: number | null;
  spills: number | null;
  // Location / administrative
  township: string;
  plss: string;
  fo: string;
  leg: string;
  // Resources
  dnrUrl: string;
  compUrl: string;
  stfacid: string;
  locid: string;
}

/** A facility paired with its [lon, lat] coordinate, used by the results list. */
export interface Facility extends FacilityProps {
  lon: number;
  lat: number;
  /** Miles from the searched address — set only on address-radius results. */
  distanceMi?: number;
}

/** One entry in static/data/zip-index.json. */
export interface ZipEntry {
  count: number;
  totalManure: number;
  totalAnimals: number;
  species: Record<string, number>;
  center: [number, number]; // [lon, lat]
  bounds: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

export type ZipIndex = Record<string, ZipEntry>;
