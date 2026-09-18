<script lang="ts">
  import { mapBus } from '$lib/state.svelte';
</script>

<div class="zoom rounded-md border border-rule shadow-md">
  <button onclick={() => mapBus.home()} aria-label="Reset to statewide view" title="Reset to statewide view">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  </button>
  <span class="div"></span>
  <button onclick={() => mapBus.zoomBy(1)} aria-label="Zoom in" title="Zoom in">+</button>
  <span class="div"></span>
  <button onclick={() => mapBus.zoomBy(-1)} aria-label="Zoom out" title="Zoom out">−</button>
</div>

<style>
  .zoom {
    display: flex;
    flex-direction: column;
    background: theme('colors.paper-2');
    overflow: hidden;
  }
  .zoom button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    background: theme('colors.paper-2');
    color: theme('colors.ink-2');
    font-size: 19px;
    line-height: 1;
    cursor: pointer;
    transition: background 150ms;
  }
  .zoom button:hover {
    background: theme('colors.paper-3');
    color: theme('colors.ink');
  }
  .div {
    height: 1px;
    background: theme('colors.rule');
  }

  @media (max-width: 720px), (max-height: 520px) {
    .zoom button {
      width: 44px;
      height: 44px;
      font-size: 22px;
    }
  }
</style>
