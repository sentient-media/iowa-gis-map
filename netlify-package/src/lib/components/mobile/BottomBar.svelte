<script lang="ts">
  import { app, ui, mapBus, toggleSheet, searchActive, type SheetId } from '$lib/state.svelte';
  import { activeCount } from '$lib/data/filters';

  const filterCount = $derived(activeCount(app.filter));

  // Leaving a facility for one of the sheets is the same "back out" gesture as
  // dismissing the facility sheet, so run the deselect (which restores the
  // pre-zoom camera) before switching.
  function pick(id: SheetId) {
    if (app.selected) mapBus.deselect();
    toggleSheet(id);
  }

  // "Results" clears whatever is covering the results sheet, then shows or
  // tucks it away — the one way back once it's been dragged fully down.
  function showResults() {
    if (app.selected) mapBus.deselect();
    if (ui.sheet) {
      ui.sheet = null;
      if (ui.detent === 'hidden') ui.detent = 'half';
      return;
    }
    ui.detent = ui.detent === 'hidden' ? 'half' : 'hidden';
  }

  const resultsActive = $derived(!ui.sheet && !app.selected && ui.detent !== 'hidden');
</script>

<nav class="bar" aria-label="Map controls">
  <button class="seg" class:on={ui.sheet === 'filters'} onclick={() => pick('filters')} aria-pressed={ui.sheet === 'filters'}>
    <span class="ico">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 7h16M7 12h10M10 17h4" />
      </svg>
      {#if filterCount > 0}<span class="badge">{filterCount}</span>{/if}
    </span>
    Filters
  </button>

  <button class="seg" class:on={resultsActive} onclick={showResults} aria-pressed={resultsActive}>
    <span class="ico">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
      {#if searchActive()}<span class="dot"></span>{/if}
    </span>
    Results
  </button>

  <button class="seg" class:on={ui.sheet === 'legend'} onclick={() => pick('legend')} aria-pressed={ui.sheet === 'legend'}>
    <span class="ico">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 16 9 5 9-5" />
      </svg>
    </span>
    Legend
  </button>
</nav>

<style>
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: flex;
    /* Bar body sits above the home indicator; the inset is padded, not margined,
       so the bar's background still bleeds to the screen edge. */
    height: calc(var(--bar-h) + var(--safe-b));
    padding-bottom: var(--safe-b);
    background: theme('colors.paper-2');
    border-top: 1px solid theme('colors.rule');
    box-shadow: 0 -2px 14px rgba(0, 0, 0, 0.08);
    font-family: theme('fontFamily.sans');
  }
  .seg {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 44px;
    border: none;
    background: none;
    color: theme('colors.ink-3');
    font-family: theme('fontFamily.sans');
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
  }
  .seg.on {
    color: theme('colors.editorial');
  }
  .ico {
    position: relative;
    display: block;
    line-height: 0;
  }
  .badge {
    position: absolute;
    top: -5px;
    right: -9px;
    display: grid;
    place-items: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: theme('colors.editorial');
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }
  .dot {
    position: absolute;
    top: -2px;
    right: -4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: theme('colors.editorial');
  }
</style>
