<script lang="ts">
  import { app } from '$lib/state.svelte';
  import { legendFor } from '$lib/data/symbology';
  import { OVERLAYS } from '$lib/data/overlays';

  // `stacked` lays the sections out vertically (the phone sheet); the default
  // grows them sideways, which suits the desktop corner card.
  let { stacked = false }: { stacked?: boolean } = $props();

  const legend = $derived(legendFor(app.mode));
  const heading = $derived(legend.kind === 'ramp' ? legend.title : 'Animal type');
  // Each overlay draws from its own zoom, so list each one only once it's
  // actually on the map — they don't arrive together, or with the imagery.
  const visibleOverlays = $derived(OVERLAYS.filter((o) => app.zoom >= o.minZoom));
</script>

<div class="cols" class:stacked>
  <div class="col">
    <span class="eyebrow col-head">{heading}</span>
    <ul class="body">
      {#each legend.items as item (item.label)}
        <li>
          <span class="dot" style="background:{item.color}"></span>
          <span class="lbl">{item.label}</span>
        </li>
      {/each}
    </ul>
  </div>
  {#each visibleOverlays as o (o.id)}
    <div class="col">
      <span class="eyebrow col-head">{o.label}</span>
      <ul class="body">
        {#each o.legend as item (item.label)}
          <li>
            <span class="sq" style="background:{item.color}"></span>
            <span class="lbl">{item.label}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</div>
<p class="note" class:stacked>{legend.note}</p>

<style>
  /* Horizontal column row; on very narrow screens it wraps rather than overflow. */
  .cols {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .col {
    flex: none;
    width: 156px;
    box-sizing: border-box;
  }
  .col + .col {
    border-left: 1px solid theme('colors.rule');
  }
  .col-head {
    display: block;
    padding: 0 10px 4px;
  }
  .body {
    padding: 2px 10px 6px;
    margin: 0;
    list-style: none;
  }
  .body li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }
  .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    flex: none;
    box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.25);
  }
  /* Square swatch marks these as area (polygon) overlays vs. the point dots. */
  .sq {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    flex: none;
    box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.25);
  }
  .lbl {
    font-size: 12.5px;
    color: theme('colors.ink-2');
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin: 0;
    padding: 6px 10px 9px;
    font-size: 10.5px;
    color: theme('colors.ink-3');
    border-top: 1px solid theme('colors.rule');
  }

  /* Sheet layout: sections stack, so extra overlay legends grow downward into
     the sheet's own scroll instead of pushing the card sideways. */
  .cols.stacked {
    flex-direction: column;
    flex-wrap: nowrap;
  }
  .cols.stacked .col {
    width: 100%;
  }
  .cols.stacked .col + .col {
    border-left: none;
    border-top: 1px solid theme('colors.rule');
    margin-top: 10px;
    padding-top: 10px;
  }
  .cols.stacked .col-head,
  .cols.stacked .body {
    padding-left: 0;
    padding-right: 0;
  }
  .cols.stacked .body li {
    padding: 5px 0;
  }
  .cols.stacked .lbl {
    font-size: 14px;
  }
  .note.stacked {
    padding: 10px 0 0;
    margin-top: 10px;
    font-size: 12.5px;
  }

  @media (max-width: 720px) {
    /* Desktop card rendered on a narrow window: stop the sideways growth. */
    .cols:not(.stacked) {
      max-height: 40dvh;
      overflow-y: auto;
    }
  }
</style>
