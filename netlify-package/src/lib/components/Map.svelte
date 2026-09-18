<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import type { Map as MlMap, Popup as MlPopup, Marker as MlMarker, GeoJSONSource } from 'maplibre-gl';
  import { app, mapBus, ui, clearSearch, searchActive, detentPx, BAR_H, TOP_RESERVED } from '$lib/state.svelte';
  import { colorExpr, radiusForMode } from '$lib/data/symbology';
  import { toExpression, passes } from '$lib/data/filters';
  import { circlePolygon, circleBounds } from '$lib/data/near';
  import { OVERLAYS, exportTileUrl } from '$lib/data/overlays';
  import { facilityCardHTML } from '$lib/data/facility-card';
  import type { Facility, FacilityProps } from '$lib/data/types';

  const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  // Two focus modes share one look: a zip selection filters the statewide
  // source, an address search feeds its own source (see below). These build the
  // paint for both so the pairs can never drift.
  const haloPaint = (mode: typeof app.mode) => ({
    'circle-color': '#ffffff',
    'circle-opacity': 0.92,
    'circle-radius': radiusForMode(mode, 1.15, 4),
    'circle-stroke-width': 3,
    'circle-stroke-color': '#FF5C00',
    'circle-stroke-opacity': 1
  });
  const focusPaint = (mode: typeof app.mode) => ({
    'circle-color': colorExpr(mode),
    'circle-radius': radiusForMode(mode, 1.15, 0),
    'circle-opacity': 1,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff'
  });

  const HALO_LAYERS = ['cafo-highlight-halo', 'cafo-near-halo'];
  const FOCUS_LAYERS = ['cafo-highlight', 'cafo-near'];

  // Phone chrome overlays the map on all four sides, so framing anything into
  // the full canvas centres it underneath the sheet. These reserve the top bar
  // and the sheet's current height; read untracked at the moment we move the
  // camera, so dragging the sheet never re-frames the map under the reader.
  function framePadding(): number | { top: number; bottom: number; left: number; right: number } {
    if (!ui.narrow || typeof window === 'undefined') return 60;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Held sideways the sheet docks to the left edge instead of the bottom, so
    // the space to reserve is width. Padding the bottom here would leave a few
    // usable pixels of height and send the camera somewhere absurd.
    if (vh <= 520 && vw >= 480) {
      return {
        top: 92,
        bottom: BAR_H + 12,
        left: Math.round(Math.min(390, vw * 0.55)) + 20,
        right: 20
      };
    }
    return {
      top: TOP_RESERVED,
      bottom: detentPx(ui.detent, vh) + BAR_H + 12,
      left: 20,
      right: 20
    };
  }

  // Iowa bounding box for the default statewide view.
  const IOWA_BOUNDS: [[number, number], [number, number]] = [
    [-96.7, 40.3],
    [-90.0, 43.6]
  ];

  // At/above this zoom the basemap switches from the muted gray-canvas tiles
  // to satellite imagery (so a clicked facility reveals the actual site).
  // Clicking a facility flies in to FLY_ZOOM — close enough to see the site's
  // buildings.
  const SAT_MIN_ZOOM = 11;
  const FLY_ZOOM = 16;

  // Esri World Light Gray Canvas (light, muted) for overview; Esri World
  // Imagery up close. Everything comes from Esri's legacy tile host, which
  // serves these raster services without an API key or an ArcGIS sign-in.
  //
  // The gray canvas is published as two services: the base (land, water,
  // roads) and a transparent "reference" layer carrying place and road
  // labels. Stacking them reproduces the labelled Light Gray Canvas basemap.
  const ESRI_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services';
  const STYLE = {
    version: 8 as const,
    sources: {
      gray: {
        type: 'raster' as const,
        tiles: [`${ESRI_TILES}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        // Both gray-canvas services stop at z16; MapLibre overzooms (scales
        // the z16 tiles) beyond that rather than requesting 404s. Moot in
        // practice, since imagery takes over at SAT_MIN_ZOOM.
        maxzoom: 16,
        attribution:
          'Tiles © Esri — Esri, HERE, Garmin, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS User Community'
      },
      'gray-labels': {
        type: 'raster' as const,
        tiles: [`${ESRI_TILES}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 16
      },
      satellite: {
        type: 'raster' as const,
        tiles: [`${ESRI_TILES}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        // Esri World Imagery serves tiles up to z19; MapLibre overzooms
        // (scales the z19 tiles) beyond that rather than requesting 404s.
        maxzoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
      }
    },
    layers: [
      // Gray canvas (base, then labels) shows below the threshold; imagery
      // at/above it.
      { id: 'gray', type: 'raster' as const, source: 'gray', maxzoom: SAT_MIN_ZOOM },
      { id: 'gray-labels', type: 'raster' as const, source: 'gray-labels', maxzoom: SAT_MIN_ZOOM },
      { id: 'satellite', type: 'raster' as const, source: 'satellite', minzoom: SAT_MIN_ZOOM }
    ]
  };

  let { data }: { data: GeoJSON.FeatureCollection } = $props();

  let container: HTMLDivElement;
  let map: MlMap | undefined;
  let MaplibreGl: typeof import('maplibre-gl') | undefined;
  let popup: MlPopup | undefined;
  let nearMarker: MlMarker | undefined;
  let ready = $state(false);

  // Camera position captured just before flying in to a facility, so a second
  // click on the same point can zoom back out to where the user was.
  let preZoomView: { center: [number, number]; zoom: number } | null = null;
  // The facility we're currently flown in to. Tracked separately from
  // `app.selected` so dismissing the card leaves the zoom toggle armed: the
  // point still knows it can take you back, even with no card on screen.
  let zoomedTo: string | null = null;

  // Set while we tear down the popup ourselves, so its `close` event isn't
  // mistaken for the user clicking the ✕ (which zooms back out).
  let closingPopup = false;

  // Stable identity for a facility, so we can tell whether a click landed on the
  // one we're already flown in to.
  //
  // It has to key off the DNR id rather than coordinates: MapLibre quantises
  // geometry when it tiles a GeoJSON source, so the lon/lat that comes back
  // from queryRenderedFeatures is close to, but not equal to, the value in the
  // source data. Comparing coordinates therefore worked only when both sides
  // came from the map, and silently failed for a facility opened from the
  // results list. Every facility in this dataset carries an id.
  const facilityKey = (f: Facility) =>
    f.stfacid ? `id:${f.stfacid}` : `xy:${f.lon.toFixed(4)},${f.lat.toFixed(4)}`;

  // Desktop-only hover preview: a small chip that follows the cursor and shows
  // just the facility name. Identification-at-a-glance without the full popup.
  // Suppressed on touch devices, where a tap emits synthetic mouse events that
  // would otherwise flash — and sometimes strand — the chip.
  let hoverLabel = $state('');
  let hoverX = $state(0);
  let hoverY = $state(0);
  const canHover = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  // Remove the popup programmatically without it being read as a user "close"
  // gesture (which would trigger a zoom-out). Guards the popup's `close` event.
  function removePopup() {
    closingPopup = true;
    popup?.remove();
    popup = undefined;
    closingPopup = false;
  }

  // Put the card away and leave the camera exactly where it is. Closing a card
  // is not a navigation: the reader is still looking at the site they flew to,
  // and yanking them back out — to the pre-zoom view or, worse, to statewide —
  // loses their place. The point itself owns zooming back out.
  function dismissCard() {
    if (!app.selected) return;
    app.selected = null;
    removePopup();
  }

  // Clicking the point you're flown in to is the way back out, and it returns
  // to the exact view you left rather than re-framing anything.
  function zoomBackOut() {
    if (!map) return;
    app.selected = null;
    removePopup();
    if (preZoomView) map.easeTo({ ...preZoomView, duration: 700 });
    preZoomView = null;
    zoomedTo = null;
  }

  function showPopup(lngLat: [number, number], p: FacilityProps) {
    if (!map || !MaplibreGl) return;
    removePopup();
    // closeOnClick is off so a map click never yanks the popup out from under
    // the click handler; the handler owns map clicks, the ✕ owns "close".
    // maxWidth is 'none' so the card's own fluid width rule governs.
    popup = new MaplibreGl.Popup({ offset: 12, closeButton: true, closeOnClick: false, maxWidth: 'none' })
      .setLngLat(lngLat)
      .setHTML(facilityCardHTML(p))
      .addTo(map);
    // Closing the popup (its ✕) is a natural "back" gesture — treat it as a
    // click-out so the user doesn't have to also hunt for the point again.
    popup.on('close', () => {
      if (!closingPopup) dismissCard();
    });
  }

  onMount(async () => {
    MaplibreGl = await import('maplibre-gl');
    await import('maplibre-gl/dist/maplibre-gl.css');

    const m = new MaplibreGl.Map({
      container,
      style: STYLE,
      bounds: IOWA_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      minZoom: 5,
      maxZoom: 20,
      attributionControl: { compact: true }
    });
    map = m;

    // Mirror zoom into shared state so the legend can reveal the overlay
    // entries once the map is zoomed in far enough for those services to draw.
    app.zoom = m.getZoom();
    m.on('zoom', () => (app.zoom = m.getZoom()));

    // Smooth, eased zoom for the custom bottom-left zoom buttons.
    mapBus.zoomBy = (delta: number) => {
      const target = Math.min(Math.max(m.getZoom() + delta, m.getMinZoom()), m.getMaxZoom());
      m.easeTo({ zoom: target, duration: 450, easing: (t) => t * (2 - t) });
    };

    // Dismissing the facility sheet on mobile is the same gesture as the
    // popup's ✕ on desktop, so both run the one deselect path.
    mapBus.deselect = dismissCard;

    // Home button: return to the statewide Iowa view from map load, clearing
    // any focused zip and open popup along the way.
    mapBus.home = () => {
      removePopup();
      preZoomView = null;
      zoomedTo = null;
      // Clearing an active search re-triggers the camera effect, which flies
      // home — so only fly here when we were already statewide.
      const hadFocus = searchActive();
      clearSearch();
      if (!hadFocus) m.fitBounds(IOWA_BOUNDS, { padding: 24, duration: 800 });
    };

    m.on('load', () => {
      // Optional reference overlays (wetlands, flood) — added first so they sit
      // above the basemap but below the CAFO points added below. Each carries
      // the zoom its service starts drawing at; without that we'd stream blank
      // tiles from both services across the whole statewide view.
      for (const o of OVERLAYS) {
        m.addSource(`overlay-${o.id}`, {
          type: 'raster',
          tiles: [exportTileUrl(o)],
          tileSize: 256,
          minzoom: o.minZoom,
          attribution: o.attribution
        });
        m.addLayer({
          id: `overlay-${o.id}`,
          type: 'raster',
          source: `overlay-${o.id}`,
          minzoom: o.minZoom,
          paint: { 'raster-opacity': 0.65 }
        });
      }

      map!.addSource('cafos', { type: 'geojson', data });

      // Paint expressions for the initial mode (kept in sync via the mode effect).
      const color = colorExpr(app.mode);
      const radius = radiusForMode(app.mode);

      m.addLayer({
        id: 'cafo-points',
        type: 'circle',
        source: 'cafos',
        paint: {
          'circle-color': color as never,
          'circle-radius': radius as never,
          'circle-opacity': 0.9,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.7
        }
      });

      // The address search radius, drawn beneath the points so it never tints
      // or obscures them.
      m.addSource('near-circle', { type: 'geojson', data: EMPTY_FC });
      m.addLayer(
        {
          id: 'near-circle-fill',
          type: 'fill',
          source: 'near-circle',
          paint: { 'fill-color': '#FF5C00', 'fill-opacity': 0.06 }
        },
        'cafo-points'
      );
      m.addLayer(
        {
          id: 'near-circle-line',
          type: 'line',
          source: 'near-circle',
          paint: {
            'line-color': '#FF5C00',
            'line-width': 1.5,
            'line-dasharray': [3, 2],
            'line-opacity': 0.85
          }
        },
        'cafo-points'
      );

      // Halo behind the focused facilities: a white disc with a brand-orange
      // ring that reads on both the light basemap and the satellite imagery.
      m.addLayer({
        id: 'cafo-highlight-halo',
        type: 'circle',
        source: 'cafos',
        filter: ['==', ['get', 'zip'], '___none___'],
        paint: haloPaint(app.mode) as never
      });

      // The active-zip facilities themselves — full color, enlarged, on top.
      m.addLayer({
        id: 'cafo-highlight',
        type: 'circle',
        source: 'cafos',
        filter: ['==', ['get', 'zip'], '___none___'],
        paint: focusPaint(app.mode) as never
      });

      // Address-radius results get their own source rather than a filter on the
      // statewide one: "within N miles" isn't expressible as a MapLibre filter,
      // and feeding it the exact list the panel renders keeps the two in step.
      m.addSource('nearby', { type: 'geojson', data: EMPTY_FC });
      m.addLayer({ id: 'cafo-near-halo', type: 'circle', source: 'nearby', paint: haloPaint(app.mode) as never });
      m.addLayer({ id: 'cafo-near', type: 'circle', source: 'nearby', paint: focusPaint(app.mode) as never });

      const toFacility = (f: GeoJSON.Feature): Facility => {
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        return { ...(f.properties as FacilityProps), lon, lat };
      };

      // Hover affordance (cursor + name chip) per interactive layer.
      const POINT_LAYERS = ['cafo-points', 'cafo-highlight', 'cafo-near'];
      for (const layer of POINT_LAYERS) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', layer, () => {
          m.getCanvas().style.cursor = '';
          hoverLabel = '';
        });
        m.on('mousemove', layer, (e) => {
          if (!canHover()) return;
          const f = e.features?.[0];
          if (!f) return;
          hoverLabel = ((f.properties as FacilityProps).name || 'Unnamed facility') as string;
          hoverX = e.point.x;
          hoverY = e.point.y;
        });
      }

      // Single map-level click handler so each click toggles exactly once.
      // (A facility in the active zip lives in BOTH point layers; registering
      // per-layer would fire twice per click — deselecting then instantly
      // re-selecting — which forced the user to click twice to zoom out.)
      m.on('click', (e) => {
        const feats = m.queryRenderedFeatures(e.point, { layers: POINT_LAYERS });
        const fac = feats.length ? toFacility(feats[0]) : null;

        // Clicking the point you're flown in to is the one gesture that zooms
        // back out — whether or not its card is still open.
        if (fac && zoomedTo === facilityKey(fac)) {
          zoomBackOut();
          return;
        }

        // Clicking empty land just puts the card away; the camera stays put so
        // a stray tap never costs the reader their place.
        if (!fac) {
          dismissCard();
          return;
        }

        // The app.selected effect is the single place that flies in, captures
        // the view to come back to, and opens the popup — so map clicks and
        // panel-list clicks share one code path.
        app.selected = fac;
      });

      // The attribution lists a basemap plus both overlay services, which wraps
      // to several lines on a phone and eats the map. Start it collapsed to its
      // ⓘ button there; tapping still expands the full credits.
      if (ui.narrow) {
        m.getContainer()
          .querySelector('.maplibregl-ctrl-attrib')
          ?.classList.remove('maplibregl-compact-show');
      }

      ready = true;
    });
  });

  // --- React to shared state (effects must live at component top level) ---

  // Restyle the layers on mode change, and "spotlight" the active search: while
  // a zip or address is focused the base points dim to grey ghosts so the
  // focused facilities (halo + enlarged points) stand out — in either mode.
  $effect(() => {
    const mode = app.mode;
    const focused = searchActive();
    if (!ready || !map) return;
    const color = colorExpr(mode) as never;

    // Base layer — dim to muted grey "ghosts" when a search is focused.
    map.setPaintProperty('cafo-points', 'circle-color', (focused ? '#7A7A7A' : color) as never);
    map.setPaintProperty('cafo-points', 'circle-radius', radiusForMode(mode) as never);
    map.setPaintProperty('cafo-points', 'circle-opacity', focused ? 0.5 : 0.9);
    map.setPaintProperty('cafo-points', 'circle-stroke-opacity', focused ? 0 : 0.6);

    // Halo + highlight (enlarged 1.15× and padded so they stay prominent zoomed out).
    for (const id of HALO_LAYERS) {
      map.setPaintProperty(id, 'circle-radius', radiusForMode(mode, 1.15, 4) as never);
    }
    for (const id of FOCUS_LAYERS) {
      map.setPaintProperty(id, 'circle-color', color);
      map.setPaintProperty(id, 'circle-radius', radiusForMode(mode, 1.15, 0) as never);
    }
  });

  // Feed the address-radius layers: the circle, its centre pin, and the
  // in-radius facilities that also pass the active filters (so the map and the
  // panel list always show the same set).
  $effect(() => {
    const near = app.near;
    const radiusMi = app.radiusMi;
    const facilities = app.facilities;
    const filter = {
      types: app.filter.types,
      county: app.filter.county,
      minAnimals: app.filter.minAnimals,
      violations: app.filter.violations
    };
    if (!ready || !map || !MaplibreGl) return;

    const circle = map.getSource('near-circle') as GeoJSONSource;
    const nearby = map.getSource('nearby') as GeoJSONSource;
    if (!near) {
      circle.setData(EMPTY_FC);
      nearby.setData(EMPTY_FC);
      nearMarker?.remove();
      nearMarker = undefined;
      return;
    }

    circle.setData({
      type: 'FeatureCollection',
      features: [circlePolygon(near.lat, near.lon, radiusMi)]
    });
    nearby.setData({
      type: 'FeatureCollection',
      features: facilities
        .filter((f) => passes(f, filter))
        .map((f) => ({
          type: 'Feature' as const,
          properties: { ...f },
          geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] }
        }))
    });

    const at: [number, number] = [near.lon, near.lat];
    if (nearMarker) nearMarker.setLngLat(at);
    else nearMarker = new MaplibreGl.Marker({ color: '#FF5C00' }).setLngLat(at).addTo(map);
  });

  // Frame the active search — the radius circle, the zip, or all of Iowa.
  $effect(() => {
    const near = app.near;
    const radiusMi = app.radiusMi;
    const searchBounds = app.searchBounds;
    if (!ready || !map) return;
    const bounds = near ? circleBounds(near.lat, near.lon, radiusMi) : searchBounds;
    if (bounds) {
      map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
        padding: untrack(framePadding) as never,
        maxZoom: near ? 13 : 12,
        duration: 800
      });
    } else {
      map.fitBounds(IOWA_BOUNDS, { padding: untrack(framePadding) as never, duration: 800 });
    }
    // A new search replaces the view a facility would have returned to, so the
    // toggle starts fresh rather than pointing at a camera that's long gone.
    preZoomView = null;
    zoomedTo = null;
    removePopup();
  });

  // Apply the user filters to the point layers; the highlight layer also keeps
  // its active-zip constraint.
  $effect(() => {
    const f = {
      types: app.filter.types,
      county: app.filter.county,
      minAnimals: app.filter.minAnimals,
      violations: app.filter.violations
    };
    const zip = app.zip;
    const county = app.county;
    if (!ready || !map) return;
    const base = toExpression(f) as never;
    map.setFilter('cafo-points', base ?? null);
    // The highlight follows whichever of the source-backed searches is active;
    // the address radius has its own source and needs no filter here.
    const focusExpr: unknown = county
      ? ['==', ['get', 'county'], county]
      : ['==', ['get', 'zip'], zip ?? '___none___'];
    const hiFilter = (base ? ['all', focusExpr, base] : focusExpr) as never;
    map.setFilter('cafo-highlight-halo', hiFilter);
    map.setFilter('cafo-highlight', hiFilter);
  });

  // Fly to a facility selected from the panel list or the map.
  $effect(() => {
    const sel = app.selected;
    if (!ready || !map || !sel) return;
    // Capture the view to come back to here, not at the click site, so a
    // facility opened from the results list gets one too. Without it, closing
    // that card had no view to restore and fell back to re-framing the whole
    // search — the "why am I back at the start" jump.
    if (!zoomedTo) {
      preZoomView = { center: [map.getCenter().lng, map.getCenter().lat], zoom: map.getZoom() };
    }
    zoomedTo = facilityKey(sel);
    // On phones the detail card is a sheet covering part of the screen, so
    // shift the target away from it — up in portrait, sideways when the sheet
    // docks to the left. Measured off the container so this mirrors the CSS
    // breakpoints without making the fly-to re-run on every resize.
    const el = map.getContainer();
    const phone = el.clientWidth <= 720 || el.clientHeight <= 520;
    const sideDocked = el.clientHeight <= 520 && el.clientWidth >= 480;
    const offset: [number, number] = !phone
      ? [0, 0]
      : sideDocked
        ? [Math.round(el.clientWidth * 0.2), 0]
        : [0, -Math.round(el.clientHeight * 0.22)];
    map.flyTo({
      center: [sel.lon, sel.lat],
      zoom: Math.max(map.getZoom(), FLY_ZOOM),
      offset,
      duration: 700
    });
  });

  // Own the anchored popup, which is the desktop half of the detail card — on
  // phones FacilitySheet renders it instead. Depending on `ui.narrow` here (and
  // not in the fly-to above) means resizing across the breakpoint with a
  // facility open swaps surfaces cleanly rather than stranding a popup.
  $effect(() => {
    const sel = app.selected;
    const narrow = ui.narrow;
    if (!ready || !map) return;
    if (!sel || narrow) removePopup();
    else showPopup([sel.lon, sel.lat], sel);
  });

  onDestroy(() => {
    removePopup();
    nearMarker?.remove();
    map?.remove();
  });
</script>

<div class="map" bind:this={container}></div>
{#if hoverLabel}
  <div class="hover-label" style="left:{hoverX}px;top:{hoverY}px">{hoverLabel}</div>
{/if}
{#if !ready}
  <div class="loading">
    <div class="loading-inline">
      <span class="pulse"></span>
      <span class="eyebrow">Loading map…</span>
    </div>
  </div>
{/if}

<style>
  .map {
    position: absolute;
    inset: 0;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: #ececec;
    pointer-events: none;
  }
  .loading-inline {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pulse {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: theme('colors.editorial');
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      transform: scale(0.7);
      opacity: 0.5;
    }
    50% {
      transform: scale(1);
      opacity: 1;
    }
  }
  /* Cursor-following name preview. Offset up-and-right of the pointer so it
     doesn't sit under the cursor; never intercepts pointer events. */
  .hover-label {
    position: absolute;
    transform: translate(14px, -50%);
    z-index: 5;
    max-width: 240px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    font-family: Onest, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: 5px;
    pointer-events: none;
  }
</style>
