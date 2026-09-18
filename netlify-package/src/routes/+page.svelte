<script lang="ts">
  import { onMount } from 'svelte';
  import Map from '$lib/components/Map.svelte';
  import Legend from '$lib/components/Legend.svelte';
  import ControlPanel from '$lib/components/ControlPanel.svelte';
  import FilterWidget from '$lib/components/FilterWidget.svelte';
  import ZoomControls from '$lib/components/ZoomControls.svelte';
  import MobileChrome from '$lib/components/mobile/MobileChrome.svelte';
  import { ui } from '$lib/state.svelte';
  import { loadData, type LoadedData } from '$lib/data/load';

  let data = $state<LoadedData | null>(null);
  let failed = $state(false);

  onMount(async () => {
    try {
      data = await loadData();
    } catch (e) {
      console.error(e);
      failed = true;
    }
  });
</script>

<div class="app">
  {#if data}
    <Map data={data.geojson} />
    {#if ui.narrow}
      <!-- Phones get an action bar and bottom sheets; floating corner cards
           leave too little map on a screen this size. -->
      <MobileChrome {data} />
    {:else}
      <div class="filter-pos">
        <FilterWidget counties={data.countyList} features={data.geojson.features} total={data.totals.facilities} />
      </div>
      <div class="panel-pos"><ControlPanel {data} /></div>
      <div class="bl-stack">
        <Legend />
      </div>
      <div class="zoom-pos"><ZoomControls /></div>
    {/if}
  {:else}
    <div class="overlay">
      {#if failed}
        <p class="body-prose">Couldn't load the map data. Please refresh.</p>
      {:else}
        <div class="loading-inline">
          <span class="pulse"></span>
          <span class="eyebrow">Loading map…</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .app {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  /* Desktop chrome: a card in each corner, kept clear of any display cutout. */
  .filter-pos {
    position: absolute;
    top: calc(12px + var(--safe-t));
    left: calc(12px + var(--safe-l));
    z-index: 3;
  }
  .panel-pos {
    position: absolute;
    top: calc(12px + var(--safe-t));
    right: calc(12px + var(--safe-r));
    z-index: 3;
  }
  /* Bottom-left: legend. */
  .bl-stack {
    position: absolute;
    left: calc(12px + var(--safe-l));
    bottom: calc(22px + var(--safe-b));
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  /* Bottom-right: zoom controls, lifted to clear the map attribution. */
  .zoom-pos {
    position: absolute;
    right: calc(10px + var(--safe-r));
    bottom: calc(36px + var(--safe-b));
    z-index: 2;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: theme('colors.paper');
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

  @media (max-width: 720px) {
    .bl-stack {
      bottom: calc(14px + var(--safe-b));
    }
  }
</style>
