<script lang="ts">
  import { app, ui, mapBus, TAP_DETENTS } from '$lib/state.svelte';
  import { facilityCardHTML } from '$lib/data/facility-card';
  import DragSheet from './DragSheet.svelte';

  /**
   * Same detail card as the desktop popup, on a sheet the reader can drag down
   * to see the satellite view we just flew to — its peek height lands on the
   * card's own identity header. Dragging past that closes it, which runs the
   * map's deselect path, identical to the popup's ✕ on desktop.
   */

  // Each facility opens at half, however the last one was left.
  let lastKey = '';
  $effect(() => {
    const sel = app.selected;
    const key = sel ? `${sel.lon},${sel.lat},${sel.stfacid ?? ''}` : '';
    if (key === lastKey) return;
    lastKey = key;
    if (key) ui.cardDetent = 'half';
  });
</script>

{#if app.selected}
  <DragSheet
    bind:detent={ui.cardDetent}
    tapDetents={TAP_DETENTS}
    peekPx={132}
    onDismiss={() => mapBus.deselect()}
    ariaLabel="Facility details"
    z={6}
    flush
  >
    {#snippet trailing()}
      <button class="close" onclick={() => mapBus.deselect()} aria-label="Close facility details">
        ✕
      </button>
    {/snippet}

    {@html facilityCardHTML(app.selected, 'sheet')}
  </DragSheet>
{/if}

<style>
  /* Sits over the grab row, clear of the handle. */
  .close {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    color: theme('colors.ink-3');
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }
</style>
