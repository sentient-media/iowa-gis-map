<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { initEmbedResizer } from '$lib/embed';
  import { initViewport } from '$lib/state.svelte';

  let { children } = $props();

  onMount(() => {
    const stopResizer = initEmbedResizer();
    const stopViewport = initViewport();
    return () => {
      stopResizer();
      stopViewport();
    };
  });
</script>

{@render children()}
