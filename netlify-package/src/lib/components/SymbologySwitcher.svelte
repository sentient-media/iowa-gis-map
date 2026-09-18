<script lang="ts">
  import { app } from '$lib/state.svelte';
  import { MODES, type Mode } from '$lib/data/symbology';

  function set(id: Mode) {
    app.mode = id;
  }
</script>

<div class="switcher" role="group" aria-label="Map symbology">
  <span class="eyebrow lbl">Color by</span>
  <div class="seg">
    {#each MODES as m (m.id)}
      <button
        class="opt"
        class:active={app.mode === m.id}
        aria-pressed={app.mode === m.id}
        onclick={() => set(m.id)}
      >
        {m.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .switcher {
    font-family: theme('fontFamily.sans');
  }
  .lbl {
    display: block;
    padding: 0 0 5px;
  }
  .seg {
    display: flex;
    gap: 4px;
  }
  .opt {
    flex: 1;
    font-family: theme('fontFamily.sans');
    font-size: 12.5px;
    font-weight: 500;
    padding: 6px 8px;
    border: 1px solid theme('colors.rule');
    border-radius: 5px;
    background: theme('colors.paper-2');
    color: theme('colors.ink-2');
    cursor: pointer;
    white-space: nowrap;
    transition: all 150ms;
  }
  .opt:hover {
    border-color: theme('colors.ink-4');
  }
  .opt.active {
    background: theme('colors.editorial');
    border-color: theme('colors.editorial');
    color: #fff;
    font-weight: 600;
  }

  @media (max-width: 720px), (max-height: 520px) {
    .opt {
      min-height: 44px;
      padding: 10px 8px;
      font-size: 13.5px;
    }
  }
</style>
