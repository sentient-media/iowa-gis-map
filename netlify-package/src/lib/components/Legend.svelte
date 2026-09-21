<script lang="ts">
  import LegendBody from './LegendBody.svelte';
  import { app } from '$lib/state.svelte';
  import { legendFor } from '$lib/data/symbology';

  let open = $state(true);
  const legend = $derived(legendFor(app.mode));
  const heading = $derived(legend.kind === 'ramp' ? legend.title : 'Animal type');
</script>

<div class="legend rounded-md border border-rule bg-paper-2/95 shadow-sm">
  <button class="head" onclick={() => (open = !open)} aria-expanded={open}>
    {#if !open}<span class="eyebrow">{heading}</span>{/if}
    <span class="toggle">{open ? '–' : '+'}</span>
  </button>
  {#if open}
    <LegendBody />
  {/if}
</div>

<style>
  .legend {
    width: fit-content;
    max-width: calc(100vw - 24px);
    font-family: theme('fontFamily.sans');
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 10px 6px;
    cursor: pointer;
    background: none;
    border: none;
  }
  .toggle {
    /* Always pin to the right, even when the heading is hidden (expanded). */
    margin-left: auto;
    font-size: 14px;
    color: theme('colors.ink-3');
    line-height: 1;
  }

  @media (max-width: 720px) {
    /* Taller toggle strip for touch. */
    .head {
      padding: 11px 12px 10px;
    }
  }
</style>
