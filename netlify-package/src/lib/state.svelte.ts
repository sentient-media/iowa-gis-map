/** Shared reactive app state (Svelte 5 runes). */
import type { Facility, ZipEntry } from '$lib/data/types';
import type { Mode } from '$lib/data/symbology';
import { defaultFilter, type FilterState } from '$lib/data/filters';
import { facilitiesWithin, boundsOf } from '$lib/data/near';

/** A geocoded address the radius search is centred on. */
export interface NearCenter {
  lat: number;
  lon: number;
  /** The matched address, shown back to the user. */
  label: string;
}

interface AppState {
  /** Active map symbology mode. */
  mode: Mode;
  /** Active map filters (county / animal type / min animals). */
  filter: FilterState;
  /** Current map zoom, mirrored from MapLibre (drives the overlay legend). */
  zoom: number;
  /** Active 5-digit zip, or null when viewing statewide. */
  zip: string | null;
  /** Active county name, or null. Mutually exclusive with `zip` and `near`. */
  county: string | null;
  /** [minLon, minLat, maxLon, maxLat] for the active zip or county. */
  searchBounds: [number, number, number, number] | null;
  /** Geocoded address for the radius search, or null. Mutually exclusive with
   *  `zip` — a search is either "this ZIP" or "within N miles of here". */
  near: NearCenter | null;
  /** Radius (miles) for the address search. */
  radiusMi: number;
  /** Facilities in the current result set — the zip's, or the in-radius ones. */
  facilities: Facility[];
  /** Facility the user clicked/selected, for fly-to + popup coordination. */
  selected: Facility | null;
}

export const app = $state<AppState>({
  mode: 'type',
  filter: defaultFilter(),
  zoom: 6,
  zip: null,
  county: null,
  searchBounds: null,
  near: null,
  radiusMi: 10,
  facilities: [],
  selected: null
});

/** Focus a zip, clearing any other search. */
export function setZip(zip: string, entry: ZipEntry | undefined, facilities: Facility[]) {
  app.near = null;
  app.county = null;
  app.zip = zip;
  app.searchBounds = entry?.bounds ?? null;
  app.facilities = facilities;
  app.selected = null;
}

/** Focus a whole county, clearing any other search. */
export function setCounty(county: string, facilities: Facility[]) {
  app.near = null;
  app.zip = null;
  app.county = county;
  app.searchBounds = boundsOf(facilities);
  app.facilities = facilities;
  app.selected = null;
}

/** Centre the radius search on a geocoded address, clearing any other search. */
export function setNear(all: Facility[], center: NearCenter, radiusMi = app.radiusMi) {
  app.zip = null;
  app.county = null;
  app.searchBounds = null;
  app.near = center;
  app.radiusMi = radiusMi;
  app.facilities = facilitiesWithin(all, center.lat, center.lon, radiusMi);
  app.selected = null;
}

/** Drop every search mode and return to the statewide view. */
export function clearSearch() {
  app.zip = null;
  app.county = null;
  app.searchBounds = null;
  app.near = null;
  app.facilities = [];
  app.selected = null;
}

/** Whether any search is narrowing the view. */
export function searchActive(): boolean {
  return !!app.zip || !!app.county || !!app.near;
}

/** Lightweight bus so out-of-tree controls (e.g. the zoom buttons) can drive
 *  the map; the Map component populates these once it's ready. */
export const mapBus = $state<{
  zoomBy: (delta: number) => void;
  home: () => void;
  /** Clear the selected facility and return the camera to the pre-zoom view. */
  deselect: () => void;
}>({
  zoomBy: () => {},
  home: () => {},
  deselect: () => {}
});

/** Which auxiliary sheet the phone layout is showing, if any. Search is no
 *  longer one of them — it lives in the top bar and the results sheet. */
export type SheetId = 'filters' | 'legend';

/**
 * Resting heights for the phone results sheet. `peek` is a fixed pixel height
 * (a grab handle plus one summary line); the others are fractions of the
 * viewport. Shared with the map so it can frame results in the strip the sheet
 * leaves visible rather than centring them underneath it.
 */
export type Detent = 'hidden' | 'peek' | 'half' | 'full';
const DETENTS: Record<Detent, number> = { hidden: 0, peek: 104, half: 0.46, full: 1 };
/** Every detent, in height order — what a drag or a flick moves between. */
export const DETENT_ORDER: Detent[] = ['hidden', 'peek', 'half', 'full'];
/** The heights tapping the header cycles through; tucking away is deliberate,
 *  so it's reachable by dragging down or the Results button, never by a tap. */
export const TAP_DETENTS: Detent[] = ['peek', 'half', 'full'];

/** Height of the phone action bar, and the space the pinned top bar needs. */
export const BAR_H = 56;
export const TOP_RESERVED = 126;

/**
 * Height of a detent in px for a given viewport. Every detent is capped so the
 * sheet stops below the pinned top bar — grown any taller it slides underneath
 * it, taking its own drag handle out of reach.
 */
export function detentPx(d: Detent, vh: number, peek = DETENTS.peek): number {
  if (d === 'hidden') return 0;
  const max = Math.max(0, vh - BAR_H - ui.topReserved);
  if (d === 'full') return max;
  if (d === 'peek') return Math.min(max, peek);
  return Math.min(max, Math.round(vh * DETENTS.half));
}

/** UI coordination. `narrow` is wired to the phone media query by
 *  `initViewport` on mount and decides which layout renders at all. */
export const ui = $state<{
  sheet: SheetId | null;
  narrow: boolean;
  detent: Detent;
  cardDetent: Detent;
  /** Measured bottom of the mobile search card plus its clearance. */
  topReserved: number;
}>({
  sheet: null,
  narrow: false,
  // Opens at half on arrival so the lede is the first thing read.
  detent: 'half',
  // The facility card keeps its own height, reset each time one is opened.
  cardDetent: 'half',
  topReserved: TOP_RESERVED
});

/** Toggle an auxiliary sheet; opening one closes whichever was open. */
export function toggleSheet(id: SheetId): void {
  ui.sheet = ui.sheet === id ? null : id;
}

/** The phone breakpoint. Short viewports count as well as narrow ones — a phone
 *  held sideways is wide but far too short for the desktop corner cards, which
 *  are sized to stack vertically. Mirrored by the `@media` blocks in the
 *  components that render inside the phone chrome. */
export const PHONE_MQ = '(max-width: 720px), (max-height: 520px)';

/** Keep `ui.narrow` in sync with the phone breakpoint. Client-only; returns a
 *  teardown. Call once from the root layout's onMount. */
export function initViewport(): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(PHONE_MQ);
  const sync = () => (ui.narrow = mq.matches);
  sync();
  mq.addEventListener('change', sync);
  return () => mq.removeEventListener('change', sync);
}
