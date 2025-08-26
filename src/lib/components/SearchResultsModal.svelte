<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { sonarr } from '$lib/api'; // même client/contract que côté React

  // Props
  export let show: {
    id: number;
    title: string;
    banner_url?: string | null;
    poster_url?: string | null;
    network?: string | null;
  };
  export let seasonNumber!: number;
  export let instanceId!: number;
  export let onClose: () => void;

  // États
  let releases: any[] = [];
  let loading = true;
  let error: string | null = null;
  let downloading: string | null = null;

  // AbortController courant
  let controller: AbortController | null = null;

  // Helpers couleurs (mêmes règles que le composant React)
  const getQualityColor = (quality: string) => {
    if (!quality) return '#757575';
    const q = quality.toLowerCase();
    if (q.includes('2160p') || q.includes('4k')) return '#9C27B0';
    if (q.includes('1080p')) return '#4CAF50';
    if (q.includes('720p')) return '#FF9800';
    if (q.includes('480p')) return '#F44336';
    return '#757575';
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    if (score >= 40) return '#F44336';
    return '#757575';
  };

  const getSeedersColor = (seeders: number) => {
    if (seeders >= 10) return '#4CAF50';
    if (seeders >= 5) return '#FF9800';
    return '#F44336';
  };

  onMount(() => {
    handleSearch();
  });

  onDestroy(() => {
    controller?.abort();
  });

  async function handleSearch() {
    // annule une recherche en cours
    controller?.abort();
    controller = new AbortController();

    loading = true;
    error = null;

    try {
      const response = await sonarr.searchSeasonPacks(
        show.id,
        seasonNumber,
        instanceId,
        controller.signal
      );
      const data = response?.data ?? {};
      releases = Array.isArray(data?.releases) ? data.releases : [];
    } catch (err: any) {
      const name = err?.name || err?.code;
      if (name === 'AbortError' || name === 'CanceledError' || name === 'ERR_CANCELED') {
        // silencieux si annulé
        return;
      }
      console.error('Search failed:', err);
      error = 'Failed to search for releases. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function handleDownload(release: any) {
    downloading = release.guid;
    try {
      await sonarr.downloadRelease(
        release.guid,
        show.id,
        seasonNumber,
        instanceId,
        release.indexer_id
      );
      onClose?.();
    } catch (err) {
      console.error('Download failed:', err);
      error = 'Failed to download release. Please try again.';
    } finally {
      downloading = null;
    }
  }

  function onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose?.();
  }

  function onImgError(e: Event) {
    const el = e.target as HTMLImageElement;
    if (el) el.style.display = 'none';
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose?.();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- Overlay -->
<div
  class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 transition-opacity duration-300"
  role="presentation"
  on:click={onOverlayClick}
>
  <!-- Modale -->
  <div
    class="relative w-full max-w-5xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden transform scale-95 opacity-0 animate-fadeIn"
    role="dialog"
    aria-modal="true"
    aria-labelledby="srchTitle"
    tabindex="-1" 
    on:click|stopPropagation
  >
    <!-- Bouton de fermeture -->
    <button
      type="button"
      class="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-800 transition-colors"
      on:click={onClose}
      aria-label="Fermer"
      autofocus
    >
      ×
    </button>

    <!-- Bannière -->
    <div
      class="h-48 relative bg-cover bg-center"
      style:background-image={show.banner_url ? `url(${show.banner_url})` : 'none'}
    >
      <div class="absolute inset-0 bg-gradient-to-b from-black/30 to-black/80"></div>
      <div class="relative z-10 flex items-center gap-4 p-4">
        {#if show.poster_url}
          <img
            src={show.poster_url}
            alt={show.title}
            class="w-24 h-36 object-cover rounded-lg border border-neutral-800 bg-neutral-950"
            on:error={onImgError}
          />
        {/if}
        <div class="min-w-0">
          <h4 id="srchTitle" class="text-xl font-semibold truncate">{show.title}</h4>
          <p class="text-sm text-neutral-300">Saison {seasonNumber}</p>
          {#if show.network}
            <span class="inline-block mt-1 text-xs text-neutral-300/80">{show.network}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Corps -->
    <div class="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-12rem)] bg-neutral-800/90 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-neutral-800">
      {#if loading}
        <div class="flex items-center gap-3 text-neutral-300">
          <div class="h-5 w-5 rounded-full border-2 border-neutral-500 border-t-transparent animate-spin"></div>
          <p>Recherche des packs de saison…</p>
        </div>

      {:else if error}
        <div class="text-center">
          <p class="text-red-400">{error}</p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 transition"
            on:click={handleSearch}
          >
            Réessayer
          </button>
        </div>

      {:else if releases.length === 0}
        <div class="text-center text-neutral-300">
          <p class="opacity-80">Aucun pack de saison trouvé pour cette saison.</p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 transition"
            on:click={handleSearch}
          >
            🔄 Rechercher à nouveau
          </button>
        </div>

      {:else}
        <div>
          <h4 class="text-lg font-semibold mb-3">
            {releases.length} pack{releases.length !== 1 ? 's' : ''} de saison trouvé{releases.length !== 1 ? 's' : ''}
          </h4>

          <div class="flex flex-col gap-3">
            {#each releases as release (release.guid)}
              <div class="flex flex-col gap-2 rounded-xl border border-neutral-800 p-3 hover:bg-neutral-700 transition">
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <!-- Infos -->
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-semibold truncate">{release.title}</span>
                      <div class="flex flex-wrap items-center gap-2">
                        {#if release.quality}
                          <span class="text-xs px-2 py-0.5 rounded-full text-white" style:background-color={getQualityColor(release.quality)}>
                            {release.quality}
                          </span>
                        {/if}
                        {#if release.quality_score != null}
                          <span class="text-xs px-2 py-0.5 rounded-full text-white" style:background-color={getQualityScoreColor(release.quality_score)}>
                            Score : {release.quality_score}
                          </span>
                        {/if}
                        {#if release.indexer}
                          <span class="text-xs px-2 py-0.5 rounded-full bg-neutral-700 text-white">{release.indexer}</span>
                        {/if}
                      </div>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-2 text-sm">
                      <div class="flex gap-2">
                        <span class="text-neutral-400">Taille :</span>
                        <span class="text-neutral-200">{release.size_formatted}</span>
                      </div>
                      <div class="flex gap-2">
                        <span class="text-neutral-400">Seeders :</span>
                        <span class="font-medium" style:color={getSeedersColor(release.seeders)}>{release.seeders}</span>
                      </div>
                      <div class="flex gap-2">
                        <span class="text-neutral-400">Leechers :</span>
                        <span class="text-neutral-200">{release.leechers}</span>
                      </div>
                      <div class="flex gap-2">
                        <span class="text-neutral-400">Âge :</span>
                        <span class="text-neutral-200">{release.age_formatted}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center sm:self-center">
                    <button
                      type="button"
                      class="inline-flex items-center rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-3 py-1.5 disabled:opacity-60 transition"
                      on:click={() => handleDownload(release)}
                      disabled={downloading === release.guid}
                    >
                      {downloading === release.guid ? '⏳ Traitement…' : '🧂 Season It !'}
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.25s ease-out forwards;
}

/* Scrollbar personnalisée */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: #1f1f1f;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: #525252;
  border-radius: 3px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: #737373;
}
</style>
