<script lang="ts">
  import SymbologySwitcher from './SymbologySwitcher.svelte';
  import ZipSelect from './ZipSelect.svelte';
  import SearchIntro from './SearchIntro.svelte';
  import ResultsPanel from './ResultsPanel.svelte';
  import { app, searchActive } from '$lib/state.svelte';
  import { commas, compact } from '$lib/data/format';
  import type { LoadedData } from '$lib/data/load';

  // Desktop chrome only — phones render MobileChrome instead, so this no longer
  // has to negotiate the top row with the filter widget.
  let { data }: { data: LoadedData } = $props();

  let expanded = $state(true);
</script>

<div class="panel rounded-md border border-rule shadow-md" class:collapsed={!expanded}>
  <div class="topbar">
    <div class="brand">
      <div class="wordmark-brand">Sentient Media</div>
      <div class="wordmark-sub">Iowa<span class="dot">·</span>Map viewer</div>
    </div>
    <button
      class="collapse"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      title={expanded ? 'Collapse' : 'Expand'}
    >
      {expanded ? '–' : '+'}
    </button>
  </div>

  {#if expanded}
    <div class="controls">
      <SearchIntro />

      <div class="stats">
        <span><strong>{commas(data.totals.facilities)}</strong> facilities</span>
        <span><strong>{compact(data.totals.animals)}</strong> animals</span>
        <span><strong>{compact(data.totals.manure)}</strong> lbs manure/yr</span>
        <span><strong>{data.totals.counties}</strong> counties</span>
      </div>

      <SymbologySwitcher />
      <ZipSelect zipIndex={data.zipIndex} byZip={data.byZip} byCounty={data.byCounty} all={data.all} />

      {#if !searchActive()}
        <p class="hint">Enter your address to see every operation within a few miles — or search a ZIP code, city, or county.</p>
      {/if}
    </div>

    {#if searchActive()}
      <div class="results">
        <ResultsPanel all={data.all} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .panel {
    width: 340px;
    max-width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
    display: flex;
    flex-direction: column;
    background: theme('colors.paper-2');
    overflow: hidden;
  }
  /* Collapsed = just the wordmark bar; shrink to fit so it tucks into the corner. */
  .panel.collapsed {
    width: auto;
  }
  .topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 13px;
    flex: none;
  }
  .wordmark-sub {
    margin-top: 1px;
  }
  .collapse {
    font-family: theme('fontFamily.sans');
    font-size: 16px;
    line-height: 1;
    width: 24px;
    height: 24px;
    flex: none;
    border: 1px solid theme('colors.rule');
    border-radius: 5px;
    background: theme('colors.paper-2');
    color: theme('colors.ink-3');
    cursor: pointer;
  }
  .collapse:hover {
    color: theme('colors.ink');
    border-color: theme('colors.ink-4');
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 13px;
    padding: 0 13px 14px;
    flex: none;
    border-top: 1px solid theme('colors.rule');
    padding-top: 13px;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-family: theme('fontFamily.sans');
    font-size: 12px;
    color: theme('colors.ink-3');
  }
  .stats strong {
    color: theme('colors.ink');
    font-variant-numeric: tabular-nums;
  }
  .hint {
    margin: 0;
    font-family: theme('fontFamily.sans');
    font-size: 12.5px;
    line-height: 1.45;
    color: theme('colors.ink-3');
  }

  .results {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 13px 13px;
    border-top: 1px solid theme('colors.rule');
  }

  @media (max-width: 720px) {
    .panel {
      width: calc(100vw - 24px);
      max-height: calc(100dvh - 24px);
    }
    /* Roomier collapse target for touch. */
    .collapse {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }
  }
</style>
