<script lang="ts">

  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  export type Instance = { id: number; name?: string; [k: string]: any };

  // Props
  export let instances: Instance[] = [];
  export let selectedId: number | '' = '';
  export let disabled: boolean = false;
  export let label: string = 'Instance Sonarr';
  export let persistKey: string = 'seasonarr_selected_instance'; // clé localStorage
  export let placeholder: string = 'Sélectionner une instance';

  const dispatch = createEventDispatcher<{ change: Instance | null }>();

  // Persiste si demandé (selectedId contrôlé depuis parent)
  function persist(id: number | '') {
    if (!browser) return;
    if (id === '' || id == null) {
      localStorage.removeItem(persistKey);
      return;
    }
    localStorage.setItem(persistKey, String(id));
  }

  // Quand l’utilisateur change la valeur
  function onChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    const id = v === '' ? '' : Number(v);
    selectedId = id;
    persist(id);
    const inst = id === '' ? null : instances.find((i) => i.id === id) ?? null;
    dispatch('change', inst);
  }
</script>

<div class="flex items-center gap-2">
  <label class="sr-only" for="sonarrSelector">{label}</label>
  <select
    id="sonarrSelector"
    class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white disabled:opacity-60"
    {disabled}
    on:change={onChange}
    bind:value={selectedId}
    aria-label={label}
  >
    <option value="">{placeholder}</option>
    {#each instances as inst (inst.id)}
      <option value={inst.id}>
        {inst.name || `Instance #${inst.id}`}
      </option>
    {/each}
  </select>
</div>
