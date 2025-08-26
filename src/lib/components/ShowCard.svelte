<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { browser } from '$app/environment';

  export let show: any;
  export let instanceId: number | null = null;
  export let isSelected: boolean = false;
  export let bulkMode: boolean = false;

  const dispatch = createEventDispatcher<{
    selectionChange: { showId: number };
    enterBulkMode: { showId: number };
  }>();

  function onCardClick() {
    if (bulkMode) return;
    if (browser && instanceId != null) {
      sessionStorage.setItem('seasonarr_selected_instance', String(instanceId));
      sessionStorage.setItem('selectedInstanceId', String(instanceId));
    }
    goto(`${base}/shows/${show.id}`);
  }

  function onRoundClick(e: MouseEvent) {
    e.stopPropagation();
    if (!bulkMode) {
      dispatch('enterBulkMode', { showId: show.id });
      dispatch('selectionChange', { showId: show.id });
    } else {
      dispatch('selectionChange', { showId: show.id });
    }
  }

  // poster fallback
  $: poster =
    show?.poster ||
    show?.poster_url ||
    show?.images?.poster ||
    show?.remotePoster ||
    '/placeholder-poster.png';

  // badges statut
  $: rawStatus = (show?.status || '').toLowerCase().trim();
  $: statusLabel =
    rawStatus === 'continuing' ? 'Continuing' :
    rawStatus === 'ended' ? 'Ended' :
    rawStatus ? show.status : null;

  $: statusClasses =
    rawStatus === 'continuing'
      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-700/40'
      : rawStatus === 'ended'
      ? 'bg-rose-600/20 text-rose-300 border-rose-700/40'
      : 'bg-gray-600/20 text-gray-300 border-gray-700/40';

  // date sous le titre
  function pickDate(s: any): string | null {
    const candidate =
      s?.firstAired || s?.first_aired || s?.premiered ||
      s?.airDate || s?.added || s?.created_at || s?.updated_at || null;
    if (!candidate) return null;
    const d = new Date(candidate);
    if (Number.isNaN(d.getTime())) return null;
    const locale = browser ? (navigator.language || 'fr-FR') : 'fr-FR';
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }
  $: displayDate = pickDate(show);
</script>

<article
  class="group relative cursor-pointer rounded-xl overflow-hidden border border-gray-800 bg-[var(--card)] hover:border-gray-700 transition"
  on:click={onCardClick}
>
<button
  class={`absolute top-2 left-2 z-10 w-4.5 h-4.5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200
    ${isSelected 
      ? 'bg-gradient-to-br from-teal-500 to-emerald-400 border-transparent shadow-sm shadow-emerald-400/40 scale-105' 
      : 'bg-black/40 border-white/40 hover:border-white/70 hover:scale-105'}
  `}
  on:click={onRoundClick}
  aria-label={bulkMode ? (isSelected ? 'Désélectionner' : 'Sélectionner') : 'Activer la sélection multiple'}
  title={bulkMode ? (isSelected ? 'Désélectionner' : 'Sélectionner') : 'Activer la sélection multiple'}
>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    class={`w-2.5 h-2.5 text-white transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`} 
    viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
  >
    <path d="M5 13l4 4L19 7" />
  </svg>
</button>

  <!-- Poster -->
  <div class="aspect-[2/3] w-full bg-gray-900">
    <img src={poster} alt={show?.title || 'Show'} class="w-full h-full object-cover group-hover:opacity-90 transition-opacity" loading="lazy" />
  </div>

  <!-- Badge statut -->
  {#if statusLabel}
    <span class={`absolute top-2 right-2 z-10 text-[10px] px-1.5 py-0.5 rounded border ${statusClasses}`}>
      {statusLabel}
    </span>
  {/if}

  <!-- Corps -->
  <div class="p-3">
    <h3 class="text-sm font-semibold truncate">{show?.title}</h3>

    <div class="mt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
      {#if show?.year}
        <span class="text-xs opacity-70">{show.year}</span>
      {/if}
      {#if (show?.missing_episode_count ?? 0) > 0}
        <span class="text-[10px] px-1.5 py-0.5 rounded border border-amber-700/40 bg-amber-600/20 text-amber-300">
          {show.missing_episode_count} missing
        </span>
      {/if}
    </div>

    {#if displayDate}
      <div class="mt-1 text-xs opacity-70">{displayDate}</div>
    {/if}
  </div>
</article>
