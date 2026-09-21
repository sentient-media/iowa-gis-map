/**
 * Geometry for the "find CAFOs near an address" radius search — distance,
 * in-radius selection, and the circle drawn on the map.
 *
 * Iowa spans ~40.4°–43.5°N, so a flat-earth approximation of a degree is good
 * to well under 1% over the radii we offer; only `distanceMi` (the number the
 * user actually reads) does the full great-circle math.
 */
import type { Facility } from './types';

const EARTH_RADIUS_MI = 3958.8;
const MI_PER_DEG_LAT = 69;
const rad = (d: number) => (d * Math.PI) / 180;

/** Radius options (miles) offered in the results panel. */
export const RADII = [5, 10, 25] as const;

/** Degrees of latitude / longitude covering `mi` miles at this latitude. */
function degSpan(lat: number, mi: number): { dLat: number; dLon: number } {
  return {
    dLat: mi / MI_PER_DEG_LAT,
    // Longitude lines converge toward the poles; clamp so the divisor can
    // never approach zero (irrelevant in Iowa, but keeps the helper total).
    dLon: mi / (MI_PER_DEG_LAT * Math.max(0.1, Math.cos(rad(lat))))
  };
}

/** Great-circle distance between two points, in miles. */
export function distanceMi(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Facilities within `radiusMi` of the point, nearest first, each copy carrying
 * its `distanceMi`. The cheap bounding-box reject keeps the trig off the vast
 * majority of the ~11k statewide points.
 */
export function facilitiesWithin(
  all: Facility[],
  lat: number,
  lon: number,
  radiusMi: number
): Facility[] {
  const { dLat, dLon } = degSpan(lat, radiusMi);
  const out: Facility[] = [];
  for (const f of all) {
    if (Math.abs(f.lat - lat) > dLat || Math.abs(f.lon - lon) > dLon) continue;
    const d = distanceMi(lat, lon, f.lat, f.lon);
    if (d <= radiusMi) out.push({ ...f, distanceMi: d });
  }
  out.sort((a, b) => (a.distanceMi ?? 0) - (b.distanceMi ?? 0));
  return out;
}

/** Polygon approximating the search radius, for drawing it on the map. */
export function circlePolygon(
  lat: number,
  lon: number,
  radiusMi: number,
  steps = 96
): GeoJSON.Feature<GeoJSON.Polygon> {
  const { dLat, dLon } = degSpan(lat, radiusMi);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** [minLon, minLat, maxLon, maxLat] enclosing the radius circle, for fitBounds. */
export function circleBounds(
  lat: number,
  lon: number,
  radiusMi: number
): [number, number, number, number] {
  const { dLat, dLon } = degSpan(lat, radiusMi);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

/** [minLon, minLat, maxLon, maxLat] enclosing a set of facilities. */
export function boundsOf(facs: Facility[]): [number, number, number, number] | null {
  if (!facs.length) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const f of facs) {
    if (f.lon < minLon) minLon = f.lon;
    if (f.lon > maxLon) maxLon = f.lon;
    if (f.lat < minLat) minLat = f.lat;
    if (f.lat > maxLat) maxLat = f.lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/** "0.4 mi" / "7.2 mi" / "13 mi" — coarser as the number grows. */
export function formatMi(d: number): string {
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} mi`;
}
