<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let page = 1; export let totalItems = 0; export let pageSize = 35;
  const dispatch = createEventDispatcher();
  $: pages = Math.max(1, Math.ceil(totalItems / pageSize));
  function go(p:number){ if(p<1||p>pages) return; dispatch('changePage', p); }
</script>
<div class="flex items-center gap-2">
  <button class="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded" on:click={() => go(page-1)}>Précédente</button>
  {#each Array(pages) as _, i}
    <button class={`px-3 py-1.5 text-sm rounded border ${i+1===page ? 'bg-teal-600 border-teal-600' : 'bg-gray-800 border-gray-700'}`} on:click={() => go(i+1)}>{i+1}</button>
  {/each}
  <button class="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded" on:click={() => go(page+1)}>Suivante</button>
</div>