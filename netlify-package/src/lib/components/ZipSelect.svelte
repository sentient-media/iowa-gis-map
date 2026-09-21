<script lang="ts">
  import { app, setZip, setCounty, setNear, clearSearch, searchActive } from '$lib/state.svelte';
  import { suggestAddresses, type GeocodeResult } from '$lib/data/geocode';
  import type { Facility, ZipIndex } from '$lib/data/types';

  /** Idle time before a partial address is sent to the geocoder. */
  const DEBOUNCE_MS = 350;

  // `compact` drops the standalone label for the phone top bar, where the
  // placeholder carries the affordance and vertical space is scarce.
  let {
    zipIndex,
    byZip,
    byCounty,
    all,
    compact = false
  }: {
    zipIndex: ZipIndex;
    byZip: Map<string, Facility[]>;
    byCounty: Map<string, Facility[]>;
    all: Facility[];
    compact?: boolean;
  } = $props();

  interface ZipOpt {
    kind: 'zip';
    zip: string;
    place: string;
    count: number;
    search: string;
  }
  interface FacOpt {
    kind: 'facility';
    facility: Facility;
    zip: string;
    name: string;
    place: string;
    search: string;
  }
  /** A whole county. Counties aren't derivable from the ZIP list — ZIPs cross
   *  county lines — so they're indexed and offered in their own right. */
  interface CountyOpt {
    kind: 'county';
    county: string;
    count: number;
    search: string;
  }
  /** A geocoder suggestion. Carries its own coordinates, so picking one applies
   *  immediately without a second lookup. */
  interface AddrOpt {
    kind: 'address';
    hit: GeocodeResult;
  }
  type Opt = CountyOpt | ZipOpt | FacOpt | AddrOpt;

  // Defensive guard: only offer Iowa-region ZIPs (IA + neighbors, 50xxx–69xxx).
  // The recalculated ZIP_CODE field is already clean, so this drops nothing today.
  const inRegion = (zip: string) => {
    const n = Number(zip);
    return n >= 50000 && n <= 69999;
  };

  const zipLabel = (zip: string, place: string) => `${zip}${place ? ` · ${place}` : ''}`;

  // One option per ZIP that has facilities, labelled with its most common place.
  // ZIPs without any (count 0) are kept out of browsing and name search — they
  // only surface when typed in full, below.
  const zipOptions: ZipOpt[] = $derived.by(() => {
    const zips = Object.keys(zipIndex).filter((zip) => inRegion(zip) && zipIndex[zip].count > 0);
    const opts = zips.map((zip): ZipOpt => {
      const facs = byZip.get(zip) ?? [];
      const cityCounts: Record<string, number> = {};
      let county = '';
      for (const f of facs) {
        if (f.city) cityCounts[f.city] = (cityCounts[f.city] || 0) + 1;
        if (!county && f.county) county = f.county;
      }
      const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const place = topCity || (county ? `${county} County` : '');
      return { kind: 'zip', zip, place, count: zipIndex[zip].count, search: `${zip} ${place} ${county}`.toLowerCase() };
    });
    opts.sort((a, b) => a.zip.localeCompare(b.zip));
    return opts;
  });

  // One option per county, matched on the bare name and on "<name> County",
  // since that's how people write it.
  const countyOptions: CountyOpt[] = $derived.by(() => {
    const opts: CountyOpt[] = [];
    for (const [county, facs] of byCounty) {
      if (county === 'Unknown') continue;
      opts.push({
        kind: 'county',
        county,
        count: facs.length,
        search: `${county} ${county} county`.toLowerCase()
      });
    }
    opts.sort((a, b) => a.county.localeCompare(b.county));
    return opts;
  });

  // One option per named facility (searched by name only), so a facility can be
  // found directly. Built from byZip so the option references the exact object
  // used elsewhere — keeps `app.selected` identity in sync with the panel/map.
  const facilityOptions: FacOpt[] = $derived.by(() => {
    const opts: FacOpt[] = [];
    for (const [zip, facs] of byZip) {
      if (!inRegion(zip)) continue;
      for (const f of facs) {
        if (!f.name) continue;
        const place = f.city || (f.county ? `${f.county} County` : '');
        opts.push({ kind: 'facility', facility: f, zip, name: f.name, place, search: f.name.toLowerCase() });
      }
    }
    return opts;
  });

  let query = $state('');
  let open = $state(false);
  let active = $state(0);
  let geocoding = $state(false);
  let geoError = $state('');

  const selectedLabel = $derived.by(() => {
    if (app.near) return app.near.label;
    if (app.county) return `${app.county} County`;
    if (!app.zip) return '';
    const o = zipOptions.find((x) => x.zip === app.zip);
    return zipLabel(app.zip, o?.place ?? zipIndex[app.zip]?.place ?? '');
  });
  const displayValue = $derived(open ? query : selectedLabel);

  // Anything starting with a house number reads as a street address, so the
  // suggestions lead; otherwise they trail the local matches, since a bare town
  // or facility name is far more likely to be one of ours.
  const isStreetAddress = (q: string) => /^\d+\s+\S/.test(q);
  // Worth a geocoder round-trip: a house number plus the start of a street
  // name. Bare ZIPs and place names are answered from local data instead.
  // Counting letters rather than requiring a run of them matters — a numbered
  // rural street like "2143 215th rd" has no three consecutive letters at all.
  const geocodable = (q: string) =>
    q.length >= 6 && /\d/.test(q) && (q.match(/[a-z]/gi)?.length ?? 0) >= 2;

  // Suggestions for the current query, refreshed as the user types.
  let addrHits = $state<GeocodeResult[]>([]);
  let token = 0;

  // The geocoder matches whole street names, never prefixes, so a half-typed
  // street genuinely can't be completed. When the query opens with a house
  // number, say that instead of a bare "no results".
  const typingAddress = $derived(/^\d/.test(query.trim()));

  // A bare 5-digit ZIP typed in full. An Iowa ZIP with no facilities is still
  // offered as a result: choosing it frames the ZIP on the map like any other,
  // with nothing to highlight, and the panel says so. A ZIP the index doesn't
  // know at all (a PO-box ZIP, or one outside Iowa — Iowa's run 50000–52899)
  // gets a straight answer instead of the generic "no results".
  const bareZip = $derived(/^\d{5}$/.test(query.trim()) ? query.trim() : '');
  const isIowaZip = (zip: string) => {
    const n = Number(zip);
    return n >= 50000 && n <= 52899;
  };
  const emptyZipOption: ZipOpt | null = $derived.by(() => {
    if (!bareZip) return null;
    const entry = zipIndex[bareZip];
    if (!entry || entry.count > 0) return null;
    return { kind: 'zip', zip: bareZip, place: entry.place ?? '', count: 0, search: bareZip };
  });

  // Debounced typeahead. The effect's cleanup cancels a pending request when
  // the query changes again, and `token` discards any reply that a later
  // keystroke has already superseded.
  $effect(() => {
    const raw = query.trim();
    const mine = ++token;
    addrHits = [];
    if (!geocodable(raw)) {
      addrHits = [];
      geoError = '';
      geocoding = false;
      return;
    }
    geocoding = true;
    geoError = '';
    const timer = setTimeout(async () => {
      try {
        const hits = await suggestAddresses(raw);
        if (mine !== token) return;
        addrHits = hits;
      } catch (e) {
        if (mine !== token) return;
        console.error(e);
        addrHits = [];
        geoError = "The address lookup isn't responding. Try again, or search by ZIP code.";
      } finally {
        if (mine === token) geocoding = false;
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      token++;
    };
  });

  // With a query: ZIP/city/county matches first, then facility-name matches.
  // With no query: browse the full ZIP list (facilities only surface on search).
  const filtered: Opt[] = $derived.by(() => {
    const raw = query.trim();
    const q = raw.toLowerCase();
    if (!q) return zipOptions.slice(0, 100);
    // Counties lead: they're the broadest thing a name can mean, and burying
    // them under the ZIPs that share the name is what made county search
    // effectively unusable.
    const cos = countyOptions.filter((o) => o.search.includes(q));
    const zips = zipOptions.filter((o) => o.search.includes(q));
    const facs = facilityOptions.filter((o) => o.search.includes(q));
    const empty: Opt[] = emptyZipOption ? [emptyZipOption] : [];
    const local: Opt[] = [...cos, ...zips, ...empty, ...facs].slice(0, 100);
    const addrs: Opt[] = addrHits.map((hit) => ({ kind: 'address', hit }));
    return isStreetAddress(raw) ? [...addrs, ...local] : [...local, ...addrs];
  });

  function choose(o: Opt) {
    if (o.kind === 'address') {
      setNear(all, { lat: o.hit.lat, lon: o.hit.lon, label: o.hit.label });
    } else if (o.kind === 'county') {
      setCounty(o.county, byCounty.get(o.county) ?? []);
    } else {
      setZip(o.zip, zipIndex[o.zip], byZip.get(o.zip) ?? []);
      // Facility results fly to the specific operation; ZIP results just frame it.
      if (o.kind === 'facility') app.selected = o.facility;
    }
    query = '';
    addrHits = [];
    open = false;
  }

  function clear() {
    clearSearch();
    query = '';
    addrHits = [];
    geoError = '';
    open = false;
  }

  function onInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    open = true;
    active = 0;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open = true;
      active = Math.min(active + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[active]) choose(filtered[active]);
    } else if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<div class="zip">
  <span class="eyebrow lbl" id="zip-label" class:sr-only={compact}>
    Find out how much manure is produced near you
  </span>
  <div class="field">
    <input
      class="input"
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls="zip-list"
      aria-labelledby="zip-label"
      autocomplete="off"
      placeholder="Address, ZIP, city, county, or facility"
      value={displayValue}
      oninput={onInput}
      onfocus={() => {
        open = true;
        query = '';
        active = 0;
      }}
      onblur={() => (open = false)}
      onkeydown={onKeydown}
    />
    {#if searchActive()}
      <button class="clear" type="button" onmousedown={(e) => e.preventDefault()} onclick={clear} title="Clear" aria-label="Clear selection">✕</button>
    {/if}
  </div>

  {#if open}
    {#if filtered.length}
      <ul class="list" id="zip-list" role="listbox" aria-label="Search results">
        {#each filtered as o, i (o.kind === 'zip' ? `z:${o.zip}` : o.kind === 'county' ? `c:${o.county}` : o.kind === 'address' ? `a:${o.hit.label}` : `f:${o.facility.uid}`)}
          <li role="option" aria-selected={i === active}>
            <button
              class="opt"
              class:active={i === active}
              onmousedown={(e) => e.preventDefault()}
              onclick={() => choose(o)}
              onmouseenter={() => (active = i)}
            >
              {#if o.kind === 'county'}
                <span class="opt-name">{o.county} County</span>
                <span class="opt-place"></span>
                <span class="opt-count">{o.count}</span>
              {:else if o.kind === 'zip'}
                <span class="opt-zip">{o.zip}</span>
                <span class="opt-place">{o.place}</span>
                <span class="opt-count">{o.count}</span>
              {:else if o.kind === 'address'}
                <span class="opt-pin" aria-hidden="true">📍</span>
                <span class="opt-place opt-addr">{o.hit.line}</span>
                <span class="opt-count">{o.hit.zip}</span>
              {:else}
                <span class="opt-name">{o.name}</span>
                <span class="opt-place">{o.place}{o.place && o.zip ? ' · ' : ''}{o.zip}</span>
                <span class="opt-tag">facility</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
      <!-- Suggestions stream in a beat after the local matches, so say so
           without disturbing the list the user is already reading. -->
      {#if geocoding}
        <div class="finding" aria-live="polite"><span class="spinner"></span> Finding addresses…</div>
      {/if}
    {:else if geocoding}
      <div class="noopt status" aria-live="polite"><span class="spinner"></span> Finding addresses…</div>
    {:else if geoError}
      <div class="noopt error">{geoError}</div>
    {:else if bareZip && isIowaZip(bareZip)}
      <div class="noopt">No active factory farms in ZIP {bareZip} with 300 or more animal units.</div>
    {:else if bareZip}
      <div class="noopt">ZIP {bareZip} isn't in Iowa — this map covers Iowa only.</div>
    {:else if typingAddress}
      <div class="noopt">Keep typing — suggestions appear once the street name is complete.</div>
    {:else}
      <div class="noopt">No matching addresses, facilities, or places.</div>
    {/if}
  {/if}
</div>

<style>
  .zip {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    display: block;
  }
  /* Hidden visually but kept for the input's aria-labelledby. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .field {
    position: relative;
    display: flex;
  }
  .input {
    flex: 1;
    min-width: 0;
    font-family: theme('fontFamily.sans');
    font-size: 15px;
    padding: 9px 32px 9px 11px;
    border: 1px solid theme('colors.rule');
    border-radius: 6px;
    background: theme('colors.paper-2');
    color: theme('colors.ink');
  }
  .input:focus {
    outline: none;
    border-color: theme('colors.editorial');
    box-shadow: 0 0 0 2px theme('colors.editorial-tint');
  }
  .clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 5px;
    background: none;
    color: theme('colors.ink-3');
    font-size: 13px;
    cursor: pointer;
  }
  .clear:hover {
    color: theme('colors.ink');
    background: theme('colors.paper-3');
  }

  .list {
    list-style: none;
    margin: 2px 0 0;
    padding: 4px;
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid theme('colors.rule');
    border-radius: 6px;
    background: theme('colors.paper-2');
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  }
  .opt {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 7px 9px;
    border: none;
    border-radius: 5px;
    background: none;
    cursor: pointer;
    font-family: theme('fontFamily.sans');
  }
  .opt.active {
    background: theme('colors.editorial-tint');
  }
  .opt-zip {
    font-size: 13.5px;
    font-weight: 600;
    color: theme('colors.ink');
    font-variant-numeric: tabular-nums;
  }
  .opt-name {
    font-size: 13.5px;
    font-weight: 600;
    color: theme('colors.ink');
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
  }
  .opt-tag {
    font-size: 10.5px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: theme('colors.ink-3');
    border: 1px solid theme('colors.rule');
    border-radius: 999px;
    padding: 1px 6px;
    white-space: nowrap;
  }
  .opt-place {
    font-size: 12.5px;
    color: theme('colors.ink-3');
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .opt-count {
    font-size: 11.5px;
    color: theme('colors.ink-3');
    font-variant-numeric: tabular-nums;
  }
  .opt-pin {
    font-size: 12px;
    line-height: 1;
  }
  /* The echoed address is the actionable label on its row, so it reads at the
     same weight as a facility name rather than as secondary place text. */
  .opt-addr {
    font-size: 13.5px;
    font-weight: 600;
    color: theme('colors.ink');
  }
  .noopt {
    padding: 9px 11px;
    font-family: theme('fontFamily.sans');
    font-size: 12.5px;
    line-height: 1.45;
    color: theme('colors.ink-3');
    border: 1px solid theme('colors.rule');
    border-radius: 6px;
    background: theme('colors.paper-2');
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  /* Footer under an already-populated list — quieter than a full status card. */
  .finding {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 11px 2px;
    font-family: theme('fontFamily.sans');
    font-size: 11.5px;
    color: theme('colors.ink-3');
  }
  .error {
    color: theme('colors.ink-2');
    border-color: theme('colors.editorial');
  }
  .spinner {
    width: 11px;
    height: 11px;
    flex: none;
    border: 2px solid theme('colors.rule');
    border-top-color: theme('colors.editorial');
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 720px), (max-height: 520px) {
    /* iOS Safari auto-zooms the page when a focused input is < 16px; keep the
       field at 16px on phones and enlarge the hit areas for touch. */
    .input {
      font-size: 16px;
      padding: 12px 40px 12px 12px;
    }
    .clear {
      width: 36px;
      height: 36px;
      right: 4px;
      font-size: 15px;
    }
    .opt {
      min-height: 44px;
      align-items: center;
      padding: 11px 10px;
    }
    .opt-zip,
    .opt-name,
    .opt-addr {
      font-size: 14.5px;
    }
    .opt-place {
      font-size: 13px;
    }
    /* Cap against short landscape viewports as well as the fixed pixel height. */
    .list {
      max-height: min(280px, 40dvh);
    }
    .noopt {
      font-size: 13.5px;
      padding: 12px;
    }
  }
</style>
