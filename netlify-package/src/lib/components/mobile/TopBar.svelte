<script lang="ts">
  import ZipSelect from '../ZipSelect.svelte';
  import type { LoadedData } from '$lib/data/load';

  // Wordmark and search in one card pinned over the map. Search lives here
  // rather than behind a bottom-bar button so it's reachable at any moment
  // without trading away the map, and so the suggestion list drops over the
  // map instead of pushing the results out of view.
  let { data }: { data: LoadedData } = $props();
</script>

<div class="top">
  <div class="card rounded-md border border-rule shadow-sm">
    <div class="brand">
      <span class="wordmark-brand">Sentient Media</span>
      <span class="wordmark-sub">Iowa<span class="dot">·</span>Map viewer</span>
    </div>
    <ZipSelect zipIndex={data.zipIndex} byZip={data.byZip} byCounty={data.byCounty} all={data.all} compact />
  </div>
</div>

<style>
  .top {
    position: absolute;
    top: calc(8px + var(--safe-t));
    left: calc(8px + var(--safe-l));
    right: calc(8px + var(--safe-r));
    z-index: 7;
  }
  .card {
    padding: 8px 10px 10px;
    background: theme('colors.paper-2');
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 0 1px 7px;
  }
  .brand .wordmark-brand {
    font-size: 15px;
  }
  .brand .wordmark-sub {
    font-size: 9.5px;
  }

  /* Held sideways the sheet docks down the left edge, so start clear of it
     rather than lying across its content. */
  @media (max-height: 520px) and (min-width: 480px) {
    .top {
      left: calc(min(390px, 55vw) + 8px + var(--safe-l));
    }
    .brand {
      padding-bottom: 5px;
    }
  }
</style>
