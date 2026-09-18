<script lang="ts">
  import { app, setNear, searchActive } from '$lib/state.svelte';
  import { speciesLabel, speciesColor, SPECIES } from '$lib/data/species';
  import { passes } from '$lib/data/filters';
  import { commas, compact, manure } from '$lib/data/format';
  import { RADII, formatMi } from '$lib/data/near';
  import type { Facility } from '$lib/data/types';

  // `all` backs the radius control: changing the radius re-runs the search
  // against the full statewide list rather than narrowing the current results.
  // `inSheet` drops the heading for the phone sheet, whose own header already
  // shows the count — the matched address stays, since it confirms the search.
  let { all, inSheet = false }: { all: Facility[]; inSheet?: boolean } = $props();

  // The result set, narrowed by the active filters (keeps the panel in sync
  // with what's shown on the map).
  const visible = $derived(app.facilities.filter((f) => passes(f, app.filter)));

  // Summary derived from the visible facilities.
  const summary = $derived.by(() => {
    const facs = visible;
    const species: Record<string, number> = {};
    let animals = 0;
    let manureSum = 0;
    for (const f of facs) {
      animals += f.animals || 0;
      manureSum += f.manure || 0;
      species[f.type] = (species[f.type] || 0) + 1;
    }
    const breakdown = SPECIES.map((s) => ({ ...s, n: species[s.key] || 0 })).filter((s) => s.n > 0);
    return { count: facs.length, animals, manure: manureSum, breakdown };
  });

  function select(f: Facility) {
    app.selected = f;
  }

  function setRadius(mi: number) {
    if (app.near) setNear(all, app.near, mi);
  }
</script>

{#if searchActive()}
  <div class="panel">
    <header class="head" class:tight={inSheet}>
      {#if !inSheet}
        {#if app.near}
          <span class="eyebrow">Within {app.radiusMi} miles</span>
        {:else if app.county}
          <span class="eyebrow">{app.county} County</span>
        {:else}
          <span class="eyebrow">ZIP {app.zip}</span>
        {/if}
        <h2 class="section-heading">{commas(summary.count)} {summary.count === 1 ? 'facility' : 'facilities'}</h2>
      {/if}
      {#if app.near}
        <p class="addr">{app.near.label}</p>
      {/if}
    </header>

    {#if app.near}
      <div class="radius" role="group" aria-label="Search radius">
        <span class="eyebrow radius-lbl">Radius</span>
        <div class="radius-opts">
          {#each RADII as r (r)}
            <button
              class="radius-opt"
              class:active={app.radiusMi === r}
              aria-pressed={app.radiusMi === r}
              onclick={() => setRadius(r)}
            >
              {r} mi
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="stats">
      <div class="stat">
        <div class="huge-number">{compact(summary.animals)}</div>
        <div class="stat-lbl">animals</div>
      </div>
      <div class="stat">
        <div class="huge-number">{compact(summary.manure)}</div>
        <div class="stat-lbl">lbs manure / yr</div>
      </div>
    </div>

    {#if summary.breakdown.length}
      <div class="breakdown">
        {#each summary.breakdown as s (s.key)}
          <span class="chip">
            <span class="chip-dot" style="background:{s.color}"></span>
            {s.label} · {s.n}
          </span>
        {/each}
      </div>
    {/if}

    {#if visible.length === 0}
      <p class="empty">
        {#if app.near}
          No facilities match the current filters within {app.radiusMi} miles. Try a wider radius.
        {:else if app.county}
          No facilities match the current filters in {app.county} County.
        {:else}
          No facilities match the current filters in this ZIP.
        {/if}
      </p>
    {:else}
    <ul class="list">
      {#each visible as f (f.stfacid || `${f.lon},${f.lat}`)}
        <li>
          <button
            class="fac"
            class:active={app.selected === f}
            onclick={() => select(f)}
          >
            <span class="fac-dot" style="background:{speciesColor(f.type)}"></span>
            <span class="fac-main">
              <span class="fac-top">
                <span class="fac-name">{f.name || 'Unnamed facility'}</span>
                {#if f.distanceMi != null}<span class="fac-dist">{formatMi(f.distanceMi)}</span>{/if}
              </span>
              <span class="fac-meta">
                {speciesLabel(f.type)} · {commas(f.animals)} animals · {manure(f.manure)}
              </span>
              {#if f.address}<span class="fac-addr">{f.address}{f.city ? `, ${f.city}` : ''}</span>{/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    {/if}

    {#if app.near}
      <p class="note">
        Addresses are resolved by the U.S. Census Bureau geocoder. Nothing you type is stored.
      </p>
    {/if}
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
  }
  .head {
    padding: 12px 0;
  }
  /* In the phone sheet the header is just the matched address. */
  .head.tight {
    padding: 0 0 10px;
  }
  .head.tight .addr {
    margin: 0;
  }
  .head .section-heading {
    margin-top: 2px;
  }
  .addr {
    margin: 4px 0 0;
    font-family: theme('fontFamily.sans');
    font-size: 12px;
    line-height: 1.4;
    color: theme('colors.ink-3');
  }
  .radius {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 12px;
  }
  .radius-lbl {
    flex: none;
  }
  .radius-opts {
    display: flex;
    gap: 4px;
  }
  .radius-opt {
    font-family: theme('fontFamily.sans');
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border: 1px solid theme('colors.rule');
    border-radius: 5px;
    background: theme('colors.paper-2');
    color: theme('colors.ink-2');
    cursor: pointer;
    transition: all 150ms;
  }
  .radius-opt:hover {
    border-color: theme('colors.ink-4');
  }
  .radius-opt.active {
    background: theme('colors.editorial');
    border-color: theme('colors.editorial');
    color: #fff;
    font-weight: 600;
  }
  .stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 14px;
    border-bottom: 1px solid theme('colors.rule');
  }
  .stat-lbl {
    font-family: theme('fontFamily.sans');
    font-size: 11px;
    color: theme('colors.ink-3');
    letter-spacing: 0.02em;
    margin-top: 2px;
  }
  .breakdown {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: theme('fontFamily.sans');
    font-size: 12px;
    color: theme('colors.ink-2');
    background: theme('colors.paper-3');
    border: 1px solid theme('colors.rule');
    border-radius: 999px;
    padding: 4px 10px;
  }
  .chip-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .empty {
    margin: 0;
    padding: 16px 0;
    font-family: theme('fontFamily.sans');
    font-size: 12.5px;
    line-height: 1.45;
    color: theme('colors.ink-3');
  }
  .note {
    margin: 0;
    padding: 12px 0 4px;
    font-family: theme('fontFamily.sans');
    font-size: 10.5px;
    line-height: 1.45;
    color: theme('colors.ink-3');
  }
  .fac {
    display: flex;
    gap: 10px;
    width: 100%;
    text-align: left;
    padding: 11px 4px;
    background: none;
    border: none;
    border-bottom: 1px solid theme('colors.rule');
    cursor: pointer;
    transition: background 150ms;
  }
  .fac:hover {
    background: theme('colors.paper-3');
  }
  .fac.active {
    background: theme('colors.editorial-tint');
  }
  .fac-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    margin-top: 4px;
    flex: none;
    box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.25);
  }
  .fac-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .fac-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .fac-name {
    font-family: theme('fontFamily.sans');
    font-size: 14px;
    font-weight: 600;
    color: theme('colors.ink');
  }
  .fac-dist {
    flex: none;
    font-family: theme('fontFamily.sans');
    font-size: 11.5px;
    font-weight: 600;
    color: theme('colors.editorial');
    font-variant-numeric: tabular-nums;
  }
  .fac-meta {
    font-family: theme('fontFamily.sans');
    font-size: 12px;
    color: theme('colors.ink-2');
  }
  .fac-addr {
    font-family: theme('fontFamily.sans');
    font-size: 11.5px;
    color: theme('colors.ink-3');
  }

  @media (max-width: 720px), (max-height: 520px) {
    .radius-opt {
      min-height: 36px;
      font-size: 13px;
      padding: 6px 14px;
    }
    .addr {
      font-size: 13px;
    }
    .fac-dist {
      font-size: 12.5px;
    }
    .note {
      font-size: 11.5px;
    }
    .fac {
      padding: 13px 4px;
    }
    .fac-name {
      font-size: 15px;
    }
    .fac-meta,
    .fac-addr {
      font-size: 12.5px;
    }
    .stat-lbl {
      font-size: 12.5px;
    }
    .chip {
      font-size: 13px;
      padding: 6px 12px;
    }
    .empty {
      font-size: 13.5px;
    }
  }
</style>
