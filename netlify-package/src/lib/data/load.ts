/** One-time fetch + indexing of the static data assets. */
import type { Facility, FacilityProps, ZipIndex } from './types';

export interface LoadedData {
  geojson: GeoJSON.FeatureCollection;
  zipIndex: ZipIndex;
  /** Every facility, flat (for the address-radius search). */
  all: Facility[];
  /** Facilities grouped by 5-digit zip (for the zip panel list). */
  byZip: Map<string, Facility[]>;
  /** Facilities grouped by county name (for county search). */
  byCounty: Map<string, Facility[]>;
  /** Sorted, de-duplicated county names (for the filter widget). */
  countyList: string[];
  totals: { facilities: number; animals: number; manure: number; counties: number };
}

let cache: Promise<LoadedData> | null = null;

/** Fetch + parse JSON, surfacing a descriptive error on a non-2xx response
 *  (a bare `.json()` on a 404/500 would throw an opaque parse error instead). */
async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export function loadData(): Promise<LoadedData> {
  if (cache) return cache;
  cache = (async () => {
    const base = import.meta.env.BASE_URL;
    const [geojson, zipIndex] = await Promise.all([
      fetchJson<GeoJSON.FeatureCollection>(`${base}data/cafos.geojson`),
      fetchJson<ZipIndex>(`${base}data/zip-index.json`)
    ]);

    const all: Facility[] = [];
    const byZip = new Map<string, Facility[]>();
    const byCounty = new Map<string, Facility[]>();
    const counties = new Set<string>();
    let animals = 0;
    let manure = 0;

    for (const f of geojson.features) {
      const p = f.properties as unknown as FacilityProps;
      const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const fac: Facility = { ...p, lon, lat };
      all.push(fac);
      animals += p.animals || 0;
      manure += p.manure || 0;
      if (p.county) {
        counties.add(p.county);
        const inCounty = byCounty.get(p.county);
        if (inCounty) inCounty.push(fac);
        else byCounty.set(p.county, [fac]);
      }
      if (p.zip) {
        const arr = byZip.get(p.zip);
        if (arr) arr.push(fac);
        else byZip.set(p.zip, [fac]);
      }
    }

    // Largest operations first in each zip's and county's list.
    for (const arr of byZip.values()) arr.sort((a, b) => b.animals - a.animals);
    for (const arr of byCounty.values()) arr.sort((a, b) => b.animals - a.animals);

    // "Unknown" is a placeholder for facilities missing a county in the source —
    // exclude it from the headline count (Iowa has 99 counties) but keep it in
    // countyList so those facilities stay filterable.
    const realCounties = counties.size - (counties.has('Unknown') ? 1 : 0);

    return {
      geojson,
      zipIndex,
      all,
      byZip,
      byCounty,
      countyList: [...counties].sort(),
      totals: { facilities: geojson.features.length, animals, manure, counties: realCounties }
    };
  })();
  return cache;
}
