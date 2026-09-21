/**
 * Build-time data pipeline for the Iowa CAFO map viewer.
 *
 * Reads the raw ArcGIS export (iowa_cafo_export.csv, 44 columns)
 * and emits two slimmed static assets consumed by the app:
 *   - static/data/cafos.geojson  — one Point feature per facility, ~30 props.
 *   - static/data/zip-index.json — per-5-digit-zip aggregates + bounds, so the
 *     zip lookup needs no runtime geocoder. Iowa ZIPs with no facilities get
 *     an empty entry whose bounds come from data/iowa-zip-bounds.json, so the
 *     map can frame them too.
 *
 * Run with:  npm run data
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'iowa_cafo_export.csv');
// Extent + place name of every Iowa ZIP from the supplied reference.
const ZIP_BOUNDS = resolve(ROOT, 'data', 'iowa-zip-bounds.json');
const OUT_DIR = resolve(ROOT, 'static', 'data');

// Iowa bounding box (a little generous) — guards against out-of-state strays.
const IOWA = { latMin: 40.0, latMax: 43.6, lonMin: -96.7, lonMax: -90.0 };

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v) => (v == null ? '' : String(v).trim());
const zip5 = (v) => {
  const m = str(v).match(/\d{5}/);
  return m ? m[0] : '';
};
// Integer or null (blank source value -> unknown, shown as "—").
const intOrNull = (v) => {
  const s = str(v);
  if (s === '') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};
// Strip leading zeros for display (e.g. "066" -> "66"); '' / '00' -> ''.
const noZeros = (v) => {
  const s = str(v).replace(/^0+/, '');
  return s;
};
const commas = (n) => Math.round(n).toLocaleString('en-US');

// Animal-unit breakdown columns -> friendly labels.
const AU_COLS = [
  ['Swine', 'Hogs'],
  ['CattleBeef', 'Beef cattle'],
  ['CattleDair', 'Dairy cattle'],
  ['Chickens', 'Chickens'],
  ['Turkeys', 'Turkeys'],
  ['SheepLGoat', 'Sheep & goats']
];
const breakdownStr = (row) => {
  const parts = [];
  for (const [col, label] of AU_COLS) {
    const au = num(row[col]);
    if (au > 0) parts.push(`${label} ${commas(au)}`);
  }
  return parts.join(' · ');
};
// PLSS descriptor: "T66N R6W Sec 33" (Iowa townships are all north).
const plssStr = (row) => {
  const tier = noZeros(row.Tier);
  const range = noZeros(row.Range);
  const sec = noZeros(row.Sectn);
  if (!tier && !range && !sec) return '';
  const dir = str(row.rangeDir);
  const r = range ? `R${range}${dir && dir !== '-' ? dir : ''}` : '';
  return [tier ? `T${tier}N` : '', r, sec ? `Sec ${sec}` : ''].filter(Boolean).join(' ');
};
// Legislative districts: "US-2 · House 92 · Senate 46".
const legStr = (row) => {
  const c = noZeros(row.Congress);
  const h = noZeros(row.StHouse);
  const s = noZeros(row.StSenate);
  return [c ? `US-${c}` : '', h ? `House ${h}` : '', s ? `Senate ${s}` : ''].filter(Boolean).join(' · ');
};

// Editorial annotations are not distinct species. Match the UI filter keys.
const animalType = (value) => {
  const label = str(value).replace(/\s+ADDED$/i, '');
  if (/^Cattle \(Beef\)$/i.test(label)) return 'Cattle (Beef)';
  const known = ['Pig', 'Cattle (Dairy)', 'Chickens', 'Turkeys', 'Sheep/Goat'];
  return known.includes(label) ? label : 'Other';
};

const records = [];
const parser = createReadStream(SRC).pipe(
  parse({ columns: true, skip_empty_lines: true, relax_quotes: true, bom: true })
);

// Only show operations with at least this many animal units (under 300 excluded).
const MIN_AU = 300;

let total = 0;
let dropped = 0;
let droppedAU = 0;
let droppedInactive = 0;
for await (const row of parser) {
  total++;
  const lat = num(row.Latitude);
  const lon = num(row.Longitude);
  if (lat < IOWA.latMin || lat > IOWA.latMax || lon < IOWA.lonMin || lon > IOWA.lonMax) {
    dropped++;
    continue;
  }
  const animalUnits = Math.round(num(row.AnimalUnit));
  if (animalUnits < MIN_AU) {
    droppedAU++;
    continue;
  }
  // Only Active operations make the map (the app has no status filter).
  if (str(row.opStatus) !== 'Active') {
    droppedInactive++;
    continue;
  }
  // Operation type (Confinement, Open Feedlot, mixed, …) is kept for the
  // popup but is not a filter: every Active 300+ AU operation makes the map.
  const opType = str(row.OperatType);
  records.push({
    facName: str(row.facName),
    address: str(row.LocAddress),
    city: str(row.CityName),
    state: str(row.State),
    // ZIP_CODE is the spatially-derived zip — fully populated, clean 5-digit,
    // all in-region.
    zip: zip5(row.ZIP_CODE),
    county: str(row.countyName),
    animalType: animalType(row.AnimalType),
    animalCount: Math.round(num(row.AnimalCount)),
    animalUnits,
    breakdown: breakdownStr(row),
    manureLbs: Math.round(num(row.est_annual_manure_lbs)),
    opStatus: str(row.opStatus),
    opType,
    // Permits (Y/N/'')
    cons: str(row.ConsPermit),
    npdes: str(row.NPDESPermit),
    mmp: str(row.MMP),
    pindexMmp: str(row.PindexMMP),
    nmp: str(row.NMP),
    // Enforcement history (count or null = unknown)
    novs: intOrNull(row.SiteNOVs),
    lastNov: str(row.DateLastNOV),
    lncs: intOrNull(row.SiteLNCs),
    orders: intOrNull(row.AdminOrders),
    spills: intOrNull(row.Spills),
    // Location / administrative
    township: str(row.TownshipNa),
    plss: plssStr(row),
    fo: noZeros(row.FO),
    leg: legStr(row),
    // Resources
    dnrUrl: str(row.Hyperlink),
    compUrl: str(row.compliacnce_page),
    stfacid: str(row.stfacid),
    locid: noZeros(String(row.LOCID).split('.')[0]),
    lat,
    lon
  });
}

// ----- GeoJSON FeatureCollection -----
// A key unique to each feature. `stfacid` is the DNR's site ID, and the
// export lists 70 of them twice — two DNR records at one site, e.g. a
// confinement and an open feedlot, with their own animals and permits (the
// DNR report links differ). Both are kept; but the UI keys its lists on this
// and Svelte refuses duplicate keys, so the repeats get a suffix.
const seen = new Map();
for (const r of records) {
  const base = r.stfacid || `${r.lon},${r.lat}`;
  const n = (seen.get(base) || 0) + 1;
  seen.set(base, n);
  r.uid = n === 1 ? base : `${base}#${n}`;
}

const features = records.map((r) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
  properties: {
    name: r.facName,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    county: r.county,
    type: r.animalType,
    animals: r.animalCount,
    units: r.animalUnits,
    breakdown: r.breakdown,
    manure: r.manureLbs,
    status: r.opStatus,
    optype: r.opType,
    cons: r.cons,
    npdes: r.npdes,
    mmp: r.mmp,
    pindexMmp: r.pindexMmp,
    nmp: r.nmp,
    novs: r.novs,
    lastNov: r.lastNov,
    lncs: r.lncs,
    orders: r.orders,
    spills: r.spills,
    township: r.township,
    plss: r.plss,
    fo: r.fo,
    leg: r.leg,
    dnrUrl: r.dnrUrl,
    compUrl: r.compUrl,
    stfacid: r.stfacid,
    locid: r.locid,
    uid: r.uid
  }
}));
const geojson = { type: 'FeatureCollection', features };

// ----- Per-zip index -----
const zipMap = new Map();
for (const r of records) {
  if (!r.zip) continue;
  let z = zipMap.get(r.zip);
  if (!z) {
    z = {
      zip: r.zip,
      count: 0,
      totalManure: 0,
      totalAnimals: 0,
      species: {},
      sumLat: 0,
      sumLon: 0,
      bounds: [Infinity, Infinity, -Infinity, -Infinity] // [minLon,minLat,maxLon,maxLat]
    };
    zipMap.set(r.zip, z);
  }
  z.count++;
  z.totalManure += r.manureLbs;
  z.totalAnimals += r.animalCount;
  z.species[r.animalType] = (z.species[r.animalType] || 0) + 1;
  z.sumLat += r.lat;
  z.sumLon += r.lon;
  z.bounds[0] = Math.min(z.bounds[0], r.lon);
  z.bounds[1] = Math.min(z.bounds[1], r.lat);
  z.bounds[2] = Math.max(z.bounds[2], r.lon);
  z.bounds[3] = Math.max(z.bounds[3], r.lat);
}

const zipIndex = {};
for (const [zip, z] of zipMap) {
  zipIndex[zip] = {
    count: z.count,
    totalManure: z.totalManure,
    totalAnimals: z.totalAnimals,
    species: z.species,
    center: [z.sumLon / z.count, z.sumLat / z.count],
    bounds: z.bounds
  };
}

// A ZIP with no facilities still gets an entry — count 0, extent from the
// Census ZCTA polygon — so searching it frames the ZIP like any other instead
// of coming up empty. `place` labels it, since there are no facilities to
// take a town name from.
const zipBounds = JSON.parse(await readFile(ZIP_BOUNDS, 'utf8'));
let emptyZips = 0;
for (const [zip, ref] of Object.entries(zipBounds)) {
  if (zipIndex[zip]) continue;
  const b = ref.bounds;
  zipIndex[zip] = {
    count: 0,
    totalManure: 0,
    totalAnimals: 0,
    species: {},
    center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
    bounds: b,
    place: ref.name
  };
  emptyZips++;
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(resolve(OUT_DIR, 'cafos.geojson'), JSON.stringify(geojson));
await writeFile(resolve(OUT_DIR, 'zip-index.json'), JSON.stringify(zipIndex));

const statewide = records.reduce(
  (a, r) => {
    a.manure += r.manureLbs;
    a.animals += r.animalCount;
    return a;
  },
  { manure: 0, animals: 0 }
);

console.log(
  `Read ${total} rows; dropped ${dropped} outside Iowa bounds, ` +
    `${droppedAU} under ${MIN_AU} AU, ${droppedInactive} not Active.`
);
console.log(`Wrote ${features.length} features -> static/data/cafos.geojson`);
console.log(
  `Wrote ${Object.keys(zipIndex).length} zips (${zipMap.size} with facilities, ` +
    `${emptyZips} without) -> static/data/zip-index.json`
);
console.log(
  `Statewide: ${statewide.animals.toLocaleString()} animals, ` +
    `${(statewide.manure / 1e9).toFixed(1)}B lbs manure/yr`
);
