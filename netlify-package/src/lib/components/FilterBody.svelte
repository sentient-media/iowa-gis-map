<script lang="ts">
  import { app } from '$lib/state.svelte';
  import { SPECIES } from '$lib/data/species';
  import {
    activeCount,
    defaultFilter,
    MIN_ANIMAL_PRESETS,
    VIOLATION_TYPES,
    passes
  } from '$lib/data/filters';
  import { commas } from '$lib/data/format';
  import type { FacilityProps } from '$lib/data/types';

  let {
    counties,
    features,
    total
  }: { counties: string[]; features: GeoJSON.Feature[]; total: number } = $props();

  const count = $derived(activeCount(app.filter));

  // How many facilities pass the active filters (mirrors what the map shows,
  // since toExpression() and passes() share the same logic). Cheap over ~11k.
  const shown = $derived(
    count === 0
      ? total
      : features.filter((f) => passes(f.properties as unknown as FacilityProps, app.filter)).length
  );

  function toggleType(key: string) {
    const t = app.filter.types;
    app.filter.types = t.includes(key) ? t.filter((k) => k !== key) : [...t, key];
  }

  function toggleViolation(key: string) {
    const v = app.filter.violations;
    app.filter.violations = v.includes(key) ? v.filter((k) => k !== key) : [...v, key];
  }

  function reset() {
    app.filter = defaultFilter();
  }
</script>

<section>
  <span class="eyebrow lbl">Animal type</span>
  <div class="chips">
    {#each SPECIES as s (s.key)}
      <button
        class="chip"
        class:on={app.filter.types.includes(s.key)}
        onclick={() => toggleType(s.key)}
        aria-pressed={app.filter.types.includes(s.key)}
      >
        <span class="chip-dot" style="background:{s.color}"></span>
        {s.label}
      </button>
    {/each}
  </div>
</section>

<section>
  <span class="eyebrow lbl">Violations on record</span>
  <div class="chips">
    {#each VIOLATION_TYPES as v (v.key)}
      <button
        class="chip"
        class:on={app.filter.violations.includes(v.key)}
        onclick={() => toggleViolation(v.key)}
        aria-pressed={app.filter.violations.includes(v.key)}
      >
        <span class="chip-dot" style="background:#C7400E"></span>
        {v.label}
      </button>
    {/each}
  </div>
</section>

<section>
  <span class="eyebrow lbl">County</span>
  <select
    class="select"
    value={app.filter.county ?? ''}
    onchange={(e) => (app.filter.county = (e.currentTarget as HTMLSelectElement).value || null)}
  >
    <option value="">All counties</option>
    {#each counties as c (c)}
      <option value={c}>{c}</option>
    {/each}
  </select>
</section>

<section>
  <span class="eyebrow lbl">Minimum animals</span>
  <select
    class="select"
    value={String(app.filter.minAnimals)}
    onchange={(e) => (app.filter.minAnimals = Number((e.currentTarget as HTMLSelectElement).value))}
  >
    {#each MIN_ANIMAL_PRESETS as p (p.value)}
      <option value={String(p.value)}>{p.label}</option>
    {/each}
  </select>
</section>

{#if count > 0}
  <p class="shown">Showing <strong>{commas(shown)}</strong> of {commas(total)} facilities</p>
  <button class="reset" onclick={reset}>Reset filters</button>
{/if}

<style>
  .lbl {
    display: block;
    margin-bottom: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: theme('fontFamily.sans');
    font-size: 11.5px;
    padding: 4px 9px;
    border: 1px solid theme('colors.rule');
    border-radius: 999px;
    background: theme('colors.paper-2');
    color: theme('colors.ink-4');
    cursor: pointer;
    transition: all 150ms;
  }
  .chip.on {
    color: theme('colors.ink');
    border-color: theme('colors.ink-3');
    background: theme('colors.paper-3');
  }
  .chip-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    opacity: 0.4;
  }
  .chip.on .chip-dot {
    opacity: 1;
  }
  .select {
    width: 100%;
    font-family: theme('fontFamily.sans');
    font-size: 13.5px;
    padding: 8px 10px;
    border: 1px solid theme('colors.rule');
    border-radius: 6px;
    background: theme('colors.paper-2');
    color: theme('colors.ink');
  }
  .select:focus {
    outline: none;
    border-color: theme('colors.editorial');
    box-shadow: 0 0 0 2px theme('colors.editorial-tint');
  }
  .shown {
    margin: 0;
    font-family: theme('fontFamily.sans');
    font-size: 12px;
    color: theme('colors.ink-3');
  }
  .shown strong {
    color: theme('colors.ink');
    font-variant-numeric: tabular-nums;
  }
  .reset {
    align-self: flex-start;
    font-family: theme('fontFamily.sans');
    font-size: 12.5px;
    padding: 6px 12px;
    border: 1px solid theme('colors.rule');
    border-radius: 6px;
    background: theme('colors.paper-2');
    color: theme('colors.ink-2');
    cursor: pointer;
  }
  .reset:hover {
    border-color: theme('colors.editorial');
    color: theme('colors.editorial');
  }

  @media (max-width: 720px), (max-height: 520px) {
    /* Keep selects at 16px so iOS Safari doesn't auto-zoom on focus, and give
       the chips a comfortable hit area for touch. */
    .select {
      font-size: 16px;
      padding: 11px 12px;
    }
    .chips {
      gap: 7px;
    }
    .chip {
      min-height: 40px;
      padding: 10px 13px;
      font-size: 13px;
    }
    .shown {
      font-size: 13px;
    }
    .reset {
      min-height: 44px;
      padding: 10px 16px;
      font-size: 13.5px;
    }
  }
</style>
