<script lang="ts">
  import FilterBody from './FilterBody.svelte';
  import { app } from '$lib/state.svelte';
  import { activeCount } from '$lib/data/filters';

  let {
    counties,
    features,
    total
  }: { counties: string[]; features: GeoJSON.Feature[]; total: number } = $props();

  let expanded = $state(false);
  const count = $derived(activeCount(app.filter));
</script>

<div class="filter rounded-md border border-rule shadow-md" class:open={expanded}>
  <button class="head" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
    <span class="eyebrow">Filter</span>
    {#if count > 0}<span class="badge">{count}</span>{/if}
    <span class="chev">{expanded ? '–' : '+'}</span>
  </button>

  {#if expanded}
    <div class="body">
      <FilterBody {counties} {features} {total} />
    </div>
  {/if}
</div>

<style>
  .filter {
    width: auto;
    max-width: calc(100vw - 24px);
    background: theme('colors.paper-2');
    font-family: theme('fontFamily.sans');
    overflow: hidden;
  }
  .filter.open {
    width: 248px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    background: none;
    border: none;
    cursor: pointer;
  }
  .badge {
    display: inline-grid;
    place-items: center;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    border-radius: 9px;
    background: theme('colors.editorial');
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
  }
  .chev {
    margin-left: auto;
    font-size: 15px;
    line-height: 1;
    color: theme('colors.ink-3');
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 13px;
    padding: 2px 12px 13px;
    border-top: 1px solid theme('colors.rule');
    padding-top: 12px;
    max-height: calc(100dvh - 90px);
    overflow-y: auto;
  }
</style>
