<script lang="ts">
  import { app, ui, TAP_DETENTS, searchActive } from '$lib/state.svelte';
  import { passes } from '$lib/data/filters';
  import { commas, compact } from '$lib/data/format';
  import DragSheet from './DragSheet.svelte';
  import SearchIntro from '../SearchIntro.svelte';
  import ResultsPanel from '../ResultsPanel.svelte';
  import type { LoadedData } from '$lib/data/load';

  /**
   * The phone results panel. Before a search it carries the lede; after one it
   * becomes the results, and the map frames them in the strip left above it
   * (see framePadding in Map.svelte).
   */
  let { data }: { data: LoadedData } = $props();

  const searching = $derived(searchActive());
  const count = $derived(app.facilities.filter((f) => passes(f, app.filter)).length);

  // A fresh search (or a radius change) reopens the sheet to half: enough to
  // read the count and the nearest results without burying the map.
  let lastSearch = '';
  $effect(() => {
    const key = app.near
      ? `n:${app.near.label}:${app.radiusMi}`
      : app.county
        ? `c:${app.county}`
        : app.zip
          ? `z:${app.zip}`
          : '';
    if (key === lastSearch) return;
    lastSearch = key;
    if (key) ui.detent = 'half';
  });
</script>

<DragSheet
  bind:detent={ui.detent}
  tapDetents={TAP_DETENTS}
  ariaLabel={searching ? 'Search results' : 'About this map'}
>
  {#snippet header()}
    {#if searching}
      <span class="title">{commas(count)} {count === 1 ? 'facility' : 'facilities'}</span>
      <span class="sub">
        {app.near
          ? `within ${app.radiusMi} miles`
          : app.county
            ? `${app.county} County`
            : `ZIP ${app.zip}`}
      </span>
    {:else}
      <span class="brand">
        <span class="wordmark-brand">Sentient Media</span>
        <span class="wordmark-sub">Iowa<span class="dot">·</span>Map viewer</span>
      </span>
    {/if}
  {/snippet}

  {#if searching}
    <ResultsPanel all={data.all} inSheet />
  {:else}
    <SearchIntro />
    <div class="stats">
      <span><strong>{commas(data.totals.facilities)}</strong> facilities</span>
      <span><strong>{compact(data.totals.animals)}</strong> animals</span>
      <span><strong>{compact(data.totals.manure)}</strong> lbs manure/yr</span>
      <span><strong>{data.totals.counties}</strong> counties</span>
    </div>
  {/if}
</DragSheet>

<style>
  .brand { display: flex; flex-direction: column; gap: 3px; }
  .brand .wordmark-brand { font-size: 21px; }
  .brand .wordmark-sub { font-size: 10px; }
  .title {
    font-family: theme('fontFamily.serif');
    font-weight: 600;
    font-size: 17px;
    line-height: 1.1;
    color: theme('colors.ink');
  }
  .sub {
    font-family: theme('fontFamily.sans');
    font-size: 12.5px;
    color: theme('colors.ink-3');
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
    padding-top: 12px;
    font-family: theme('fontFamily.sans');
    font-size: 13px;
    color: theme('colors.ink-3');
  }
  .stats strong {
    color: theme('colors.ink');
    font-variant-numeric: tabular-nums;
  }
</style>
