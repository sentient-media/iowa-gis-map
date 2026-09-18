/**
 * Optional reference overlays sourced from Esri Living Atlas / authoritative
 * ArcGIS services, rendered as semi-transparent raster tiles on top of the
 * basemap (but below the CAFO points).
 *
 * These nationwide polygon datasets are far too large to ship as GeoJSON, so
 * we let the ArcGIS dynamic map services render them server-side and request
 * them as transparent PNGs via the REST `export` endpoint. MapLibre substitutes
 * `{bbox-epsg-3857}` per tile, turning a raster source into a stream of
 * per-tile `export` calls — the same pattern already used for the Esri World
 * Imagery satellite basemap.
 *
 * The endpoints below are the authoritative services that the Living Atlas
 * "USA Wetlands" and "USA Flood Hazard Areas" layers wrap (USFWS National
 * Wetlands Inventory and FEMA National Flood Hazard Layer). Swapping in a
 * different ArcGIS MapServer is just a matter of editing `service` here.
 */

export type OverlayId = 'wetlands' | 'flood';

/**
 * Each service refuses to draw above a scale of its own choosing, published as
 * `minScale` in its MapServer metadata, and returns a blank tile beyond it. The
 * per-overlay `minZoom` below is that threshold converted to a zoom level for
 * the 256px/96dpi tiles we request, and confirmed by fetching real tiles:
 *
 *   wetlands  minScale 100,000     blank through z12, draws from z13
 *   flood     minScale  36,112     blank through z13, draws from z14
 *
 * These deliberately do NOT match SAT_MIN_ZOOM. The satellite imagery arrives
 * at z11, but neither overlay has anything to show for another two to three
 * zoom levels, so tying them to the imagery made the legend advertise layers
 * that weren't on the map yet.
 */

export interface OverlayLegendItem {
  color: string;
  label: string;
}

export interface OverlayDef {
  id: OverlayId;
  label: string;
  /** One-line description shown under the toggle. */
  blurb: string;
  /** First zoom at which this service actually draws — see the note above. */
  minZoom: number;
  /** ArcGIS dynamic MapServer base URL (no trailing slash). */
  service: string;
  /**
   * Optional `layers` param value (e.g. `show:28`) to restrict which sublayers
   * are drawn. Omit to render the service's default visible layers.
   */
  layers?: string;
  attribution: string;
  legend: OverlayLegendItem[];
}

/**
 * Build the per-tile `export` URL template for a dynamic ArcGIS MapServer.
 * MapLibre fills `{bbox-epsg-3857}` with each tile's Web-Mercator bounds.
 */
export function exportTileUrl(o: OverlayDef): string {
  const params = new URLSearchParams({
    bbox: '{bbox-epsg-3857}',
    bboxSR: '3857',
    imageSR: '3857',
    size: '256,256',
    dpi: '96',
    format: 'png32',
    transparent: 'true',
    f: 'image'
  });
  if (o.layers) params.set('layers', o.layers);
  // URLSearchParams percent-encodes the curly braces; MapLibre needs them raw.
  const qs = params.toString().replace('%7Bbbox-epsg-3857%7D', '{bbox-epsg-3857}');
  return `${o.service}/export?${qs}`;
}

export const OVERLAYS: OverlayDef[] = [
  {
    id: 'wetlands',
    label: 'Wetlands',
    blurb: 'National Wetlands Inventory (USFWS).',
    minZoom: 13,
    service:
      'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer',
    attribution:
      'Wetlands: U.S. Fish & Wildlife Service, National Wetlands Inventory (via Esri Living Atlas)',
    legend: [
      { color: '#5aa9d6', label: 'Freshwater ponds / lakes' },
      { color: '#3f9e6f', label: 'Freshwater emergent / forested' },
      { color: '#8b6db3', label: 'Riverine / estuarine' }
    ]
  },
  {
    id: 'flood',
    label: 'Flood hazard',
    blurb: 'FEMA flood hazard zones (NFHL).',
    minZoom: 14,
    service: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    // Layer 28 = "Flood Hazard Zones" — the flood-zone polygons, without the
    // NFHL's cross-sections, base-flood-elevation lines, and other clutter.
    layers: 'show:28',
    attribution: 'Flood hazard: FEMA National Flood Hazard Layer (via Esri Living Atlas)',
    legend: [
      { color: '#2b6cb0', label: '1% annual chance (100-yr)' },
      { color: '#7fb2e0', label: '0.2% annual chance (500-yr)' },
      { color: '#e0873f', label: 'Regulatory floodway' }
    ]
  }
];
