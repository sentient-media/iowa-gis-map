<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { detentPx, DETENT_ORDER, type Detent } from '$lib/state.svelte';

  /**
   * A bottom sheet the reader drags between resting heights. Both phone panels
   * — the results list and the facility card — are one of these, so the gesture
   * means the same thing wherever it's used.
   *
   * Dragging below the smallest detent either tucks the sheet away or, when the
   * caller passes `onDismiss`, closes it outright.
   */
  let {
    detent = $bindable(),
    tapDetents,
    peekPx = 104,
    onDismiss,
    ariaLabel,
    z = 4,
    flush = false,
    header,
    trailing,
    children
  }: {
    detent: Detent;
    /** Heights a tap cycles through; dragging can reach all of DETENT_ORDER. */
    tapDetents: Detent[];
    peekPx?: number;
    onDismiss?: () => void;
    ariaLabel: string;
    z?: number;
    /** Drop the body padding for content that brings its own. */
    flush?: boolean;
    header?: Snippet;
    trailing?: Snippet;
    children: Snippet;
  } = $props();

  let vh = $state(800);
  let dragging = $state(false);
  let dragH = $state(0);

  const restH = $derived(detentPx(detent, vh, peekPx));
  const height = $derived(dragging ? dragH : restH);

  onMount(() => {
    const sync = () => (vh = window.innerHeight);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  });

  let startY = 0;
  let startH = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;

  function nearest(h: number): Detent {
    return DETENT_ORDER.reduce((best, d) =>
      Math.abs(detentPx(d, vh, peekPx) - h) < Math.abs(detentPx(best, vh, peekPx) - h) ? d : best
    );
  }

  function settle(d: Detent) {
    if (d === 'hidden' && onDismiss) {
      onDismiss();
      return;
    }
    detent = d;
  }

  function onPointerDown(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = true;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    startH = dragH = restH;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const max = detentPx('full', vh, peekPx);
    dragH = Math.min(max, Math.max(0, startH + (startY - e.clientY)));
    const dt = e.timeStamp - lastT;
    // Positive velocity = moving upward (growing the sheet).
    if (dt > 0) velocity = (lastY - e.clientY) / dt;
    lastY = e.clientY;
    lastT = e.timeStamp;
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    // Barely moved: treat it as a tap and step to the next height.
    if (Math.abs(startY - lastY) < 6) {
      cycle();
      return;
    }
    // A short, decisive flick steps one detent from where it began — measured
    // from the start, not the release point, so a quick flick down from half
    // lands on peek instead of skipping it and dismissing the sheet. A long
    // drag is a deliberate placement, so that just settles where it was let go.
    const travel = Math.abs(startH - dragH);
    if (Math.abs(velocity) > 0.5 && travel < 120) {
      const i = DETENT_ORDER.indexOf(nearest(startH));
      const last = DETENT_ORDER.length - 1;
      settle(DETENT_ORDER[velocity > 0 ? Math.min(i + 1, last) : Math.max(i - 1, 0)]);
    } else {
      settle(nearest(dragH));
    }
  }

  function cycle() {
    const i = tapDetents.indexOf(detent);
    detent = tapDetents[(i + 1) % tapDetents.length];
  }
</script>

<section
  class="sheet"
  class:dragging
  class:tucked={height === 0}
  inert={height === 0}
  style="height:{height}px; z-index:{z}"
  aria-label={ariaLabel}
>
  <button
    class="grab"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    aria-label="Resize panel — currently {detent}"
  >
    <span class="handle"></span>
    {#if header}<span class="head">{@render header()}</span>{/if}
  </button>

  {#if trailing}{@render trailing()}{/if}

  <div class="body" class:flush>
    {@render children()}
  </div>
</section>

<style>
  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--bar-h) + var(--safe-b));
    display: flex;
    flex-direction: column;
    background: theme('colors.paper-2');
    border-top: 1px solid theme('colors.rule');
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.16);
    font-family: theme('fontFamily.sans');
    overflow: hidden;
    transition:
      height 240ms cubic-bezier(0.32, 0.72, 0, 1),
      box-shadow 240ms ease;
  }
  /* No easing while the finger is down — the sheet must track it exactly. */
  .sheet.dragging {
    transition: none;
  }
  /* Dragged all the way down: nothing left on screen, so drop the edge too. */
  .sheet.tucked {
    box-shadow: none;
    border-top-color: transparent;
    pointer-events: none;
  }

  .grab {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    padding: 8px 14px 10px;
    border: none;
    border-bottom: 1px solid theme('colors.rule');
    background: none;
    text-align: left;
    cursor: grab;
    /* Claim the vertical gesture so the browser doesn't scroll the page. */
    touch-action: none;
  }
  .sheet.dragging .grab {
    cursor: grabbing;
  }
  .handle {
    align-self: center;
    width: 38px;
    height: 4px;
    border-radius: 2px;
    background: theme('colors.rule');
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 12px 14px 16px;
  }
  .body.flush {
    padding: 0;
  }

  /* Phone held sideways: dock beside the map rather than across it. */
  @media (max-height: 520px) and (min-width: 480px) {
    .sheet {
      right: auto;
      width: min(390px, 55vw);
      top: calc(8px + var(--safe-t));
      /* Height is driven inline for the drag; sideways it fills instead. */
      height: auto !important;
      border-radius: 0 14px 0 0;
    }
    .grab {
      cursor: default;
    }
    .handle {
      display: none;
    }
  }
</style>
