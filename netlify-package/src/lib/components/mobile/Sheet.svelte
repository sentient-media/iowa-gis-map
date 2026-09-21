<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ui } from '$lib/state.svelte';

  // A bottom sheet docked above the action bar. The map stays visible (and
  // interactive) above it — the sheet is a panel, not a modal.
  let {
    title,
    onclose,
    children
  }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<section class="sheet" aria-label={title} style="--top-reserved:{ui.topReserved}px">
  <header class="head">
    <span class="eyebrow">{title}</span>
    <button class="close" onclick={onclose} aria-label="Close {title}">✕</button>
  </header>
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--bar-h) + var(--safe-b));
    z-index: 4;
    display: flex;
    flex-direction: column;
    max-height: min(60dvh, calc(100dvh - var(--top-reserved) - var(--bar-h) - var(--safe-b)));
    background: theme('colors.paper-2');
    border-top: 1px solid theme('colors.rule');
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.16);
    font-family: theme('fontFamily.sans');
    animation: sheet-in 180ms ease-out;
  }
  @keyframes sheet-in {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex: none;
    padding: 12px 14px 10px;
    border-bottom: 1px solid theme('colors.rule');
  }
  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: -10px -10px -10px 0;
    border: none;
    background: none;
    color: theme('colors.ink-3');
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* Keep sheet scrolling from chaining to the map/page behind it. */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 14px;
  }

  /* Phone held sideways: a full-width sheet would leave a sliver of map, so
     dock to one side and use the height instead. */
  @media (max-height: 520px) and (min-width: 480px) {
    .sheet {
      right: auto;
      width: min(390px, 55vw);
      max-height: none;
      top: calc(8px + var(--safe-t));
      left: var(--safe-l);
      border-radius: 0 14px 0 0;
    }
  }
</style>
