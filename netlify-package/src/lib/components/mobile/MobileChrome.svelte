<script lang="ts">
  import BottomBar from './BottomBar.svelte';
  import Sheet from './Sheet.svelte';
  import FacilitySheet from './FacilitySheet.svelte';
  import TopBar from './TopBar.svelte';
  import ResultsSheet from './ResultsSheet.svelte';
  import FilterBody from '../FilterBody.svelte';
  import LegendBody from '../LegendBody.svelte';
  import SymbologySwitcher from '../SymbologySwitcher.svelte';
  import ZoomControls from '../ZoomControls.svelte';
  import { onMount } from 'svelte';
  import { app, ui, detentPx } from '$lib/state.svelte';
  import type { LoadedData } from '$lib/data/load';

  let { data }: { data: LoadedData } = $props();

  let vh = $state(800);
  onMount(() => {
    const sync = () => (vh = window.innerHeight);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  });

  // The facility card owns the bottom of the screen while it's up, so a sheet
  // never stacks behind it.
  $effect(() => {
    if (app.selected) ui.sheet = null;
  });

  // Only one panel holds the bottom of the screen at a time: the facility card
  // wins, then filters/legend, then the results sheet underneath both.
  const showResults = $derived(!app.selected && !ui.sheet);

  // Ride above the results sheet rather than hiding behind it. While a facility
  // card or an auxiliary sheet is up they'd be buried whatever we do, so they
  // step aside instead.
  const zoomBottom = $derived(showResults ? detentPx(ui.detent, vh) + 10 : 0);
</script>

<TopBar {data} />

{#if showResults}
  <div class="zoom-pos" style="--sheet-h:{zoomBottom}px"><ZoomControls /></div>
{/if}

{#if ui.sheet === 'filters'}
  <Sheet title="Filters" onclose={() => (ui.sheet = null)}>
    <div class="stack">
      <FilterBody
        counties={data.countyList}
        features={data.geojson.features}
        total={data.totals.facilities}
      />
    </div>
  </Sheet>
{:else if ui.sheet === 'legend'}
  <Sheet title="Legend" onclose={() => (ui.sheet = null)}>
    <div class="stack">
      <SymbologySwitcher />
      <LegendBody stacked />
    </div>
  </Sheet>
{/if}

{#if showResults}
  <ResultsSheet {data} />
{/if}

<FacilitySheet />

<BottomBar />

<style>
  /* Lifted clear of the action bar and whatever height the sheet is resting at;
     matches the sheet's own easing so the two move together. */
  .zoom-pos {
    position: absolute;
    right: calc(10px + var(--safe-r));
    bottom: calc(var(--bar-h) + var(--safe-b) + var(--sheet-h, 38px));
    z-index: 2;
    transition: bottom 240ms cubic-bezier(0.32, 0.72, 0, 1);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  /* Sideways the sheet docks to the left at a fixed height, so the zoom stack
     stops tracking it and sits in the corner again. */
  @media (max-height: 520px) and (min-width: 480px) {
    .zoom-pos {
      bottom: calc(var(--bar-h) + var(--safe-b) + 10px);
    }
  }
</style>
