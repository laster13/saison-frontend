<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { sonarr, settings } from '$lib/api';
  import EnhancedProgressBar from '$lib/components/EnhancedProgressBar.svelte';
  import SearchResultsModal from '$lib/components/SearchResultsModal.svelte';
  import logoTransparent from '$lib/assets/logotransparent.png';

  // ✅ on récupère l'utilisateur directement depuis $page.data (layout.ts l’a chargé)
  $: user = $page.data.user;

  let showIdParam: string;
  let show: any = null;
  let loading = true;
  let error: string | null = null;
  let expandedSeasons: Set<number> = new Set();
  let instanceId: number | null = null;
  let searchModalOpen = false;
  let searchModalSeason: number | null = null;

  onMount(async () => {
    showIdParam = (get(page).params as { id?: string }).id ?? '';

    if (browser) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("instanceId");

      if (fromUrl) {
        instanceId = parseInt(fromUrl, 10);
        sessionStorage.setItem("selectedInstanceId", instanceId.toString());
      } else {
        const stored = sessionStorage.getItem("selectedInstanceId");
        if (stored) {
          instanceId = parseInt(stored, 10);
        } else {
          try {
            const res = await sonarr.getInstances();
            if (res.data.length > 0) {
              instanceId = res.data[0].id;
              sessionStorage.setItem("selectedInstanceId", instanceId.toString());
            }
          } catch (e) {
            console.error("Impossible de charger les instances Sonarr", e);
          }
        }
      }
    }

    if (instanceId) {
      await loadShowDetail();
    } else {
      loading = false;
    }
  });

  async function loadShowDetail() {
    try {
      loading = true;
      error = null;
      const res = await sonarr.getShowDetail(showIdParam, instanceId);
      console.log("📺 Show reçu:", res?.data);
      show = res?.data ?? null;
    } catch (e) {
      console.error("❌ loadShowDetail error:", e);
      error = 'Impossible de charger les détails de la série';
    } finally {
      loading = false;
    }
  }

  function getStatusColor(status: string) {
    switch ((status || '').toLowerCase()) {
      case 'continuing':
        return 'bg-emerald-600 text-white';
      case 'ended':
        return 'bg-red-600 text-white';
      default:
        return 'bg-amber-600 text-white';
    }
  }

  function toggleSeason(seasonNumber: number) {
    const next = new Set(expandedSeasons);
    next.has(seasonNumber) ? next.delete(seasonNumber) : next.add(seasonNumber);
    expandedSeasons = next;
  }

  async function handleSeasonIt(seasonNumber: number | null = null) {
    try {
      const userSettings = await settings.getSettings();
      const requireConfirmation = userSettings?.data?.require_deletion_confirmation;
      const skipDeletion = userSettings?.data?.skip_episode_deletion;
      if (requireConfirmation && !skipDeletion) {
        const msg = seasonNumber !== null
          ? `Êtes-vous sûr de vouloir supprimer les épisodes existants de la saison ${seasonNumber} de « ${show.title} » et télécharger le pack saison ?`
          : `Êtes-vous sûr de vouloir supprimer les épisodes existants de toutes les saisons de « ${show.title} » et télécharger les packs saison ?`;
        if (!window.confirm(msg)) return;
      }
      await sonarr.seasonIt(show.id, seasonNumber, instanceId);
    } catch {}
  }

  function handleInteractiveSearch(seasonNumber: number) {
    searchModalSeason = seasonNumber;
    searchModalOpen = true;
  }

  function handleCloseSearchModal() {
    searchModalOpen = false;
    searchModalSeason = null;
  }

  function formatDate(dateString?: string) {
    return dateString ? new Date(dateString).toLocaleDateString() : '';
  }

  function getEpisodeStatus(episode: any) {
    if (!episode?.monitored) return 'non surveillé';
    if (episode?.hasFile) return 'téléchargé';
    return 'manquant';
  }

  function getEpisodeStatusColor(status: string) {
    switch (status) {
      case 'téléchargé':
        return 'text-emerald-500';
      case 'manquant':
        return 'text-red-500';
      case 'non surveillé':
        return 'text-gray-500';
      default:
        return 'text-amber-500';
    }
  }

  function goBack() {
    window.history.back();
  }

  function goHome() {
    goto(`${base}/`);
  }
</script>

<!-- Ton HTML reste identique -->

{#if loading}

  <div class="py-10 px-4 text-center text-gray-400">Chargement des détails de la série...</div>

{:else if error}
  <div class="py-10 px-4 text-center text-red-500">
    {error}
    <button on:click={() => goto('/season/dashboard')} class="ml-2 inline-block text-blue-400 hover:underline">
    ← Retour
    </button>
  </div>

{:else if !show}
  <div class="py-10 px-4 text-center text-gray-400">
    Série introuvable
    <button on:click={() => goto('/season/dashboard')} class="ml-2 inline-block text-blue-400 hover:underline">
    ← Retour
    </button>
  </div>

{:else}
  <div class="mx-auto max-w-6xl p-4 sm:p-6 text-white">
    <!-- Header -->
    <div class="show-detail-header flex items-center">
      <div class="logo-container flex items-center cursor-pointer" on:click={() => goto('/season/dashboard')}>
        <img src={logoTransparent} alt="Seasonarr" class="logo w-10 h-10" />
        <h1 class="seasonarr-logo-text ml-3 text-2xl">Détail de la Série</h1>
      </div>
    </div>
    <!-- Hero -->
    <div class="rounded-xl bg-gray-900 p-4 shadow-lg sm:p-6">
      <div class="flex flex-col gap-4 sm:gap-6 md:flex-row">
        <!-- Poster -->
        <div class="mx-auto w-40 flex-shrink-0 sm:w-44 md:mx-0 md:w-48">
          {#if show.poster_url}
            <img src={show.poster_url} alt={show.title} class="h-auto w-full rounded-lg shadow-md" />
          {:else}
            <div class="flex h-64 w-full items-center justify-center rounded-lg bg-gray-700">Pas d'image</div>
          {/if}
        </div>

        <!-- Info -->
        <div class="flex-1">
          <h2 class="mb-2 text-2xl font-bold sm:text-3xl">
            {show.title} {#if show.year}({show.year}){/if}
          </h2>

          <div class="mb-4 flex flex-wrap items-center gap-2">
            <span class={`px-2 py-1 rounded text-xs sm:text-sm ${getStatusColor(show.status)}`}>{show.status}</span>
            {#if show.monitored}
              <span class="text-xs text-gray-300 sm:text-sm">Surveillée</span>
            {/if}
          </div>

          <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div class="text-xs text-gray-400 sm:text-sm">Épisodes</div>
              <div class="text-sm font-semibold sm:text-base">{show.episode_count}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400 sm:text-sm">Manquants</div>
              <div class="text-sm font-semibold sm:text-base">{show.missing_episode_count}</div>
            </div>
            {#if show.network}
              <div>
                <div class="text-xs text-gray-400 sm:text-sm">Chaîne</div>
                <div class="text-sm font-semibold sm:text-base">{show.network}</div>
              </div>
            {/if}
            {#if show.runtime}
              <div>
                <div class="text-xs text-gray-400 sm:text-sm">Durée</div>
                <div class="text-sm font-semibold sm:text-base">{show.runtime} min</div>
              </div>
            {/if}
          </div>

          {#if Array.isArray(show.genres) && show.genres.length > 0}
            <div class="mb-4">
              <div class="mb-1 text-xs text-gray-400 sm:text-sm">Genres :</div>
              <div class="flex flex-wrap gap-2">
                {#each show.genres as genre}
                  <span class="rounded-full bg-gray-800 px-2 py-1 text-xs sm:text-sm">{genre}</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if show.overview}
            <div class="mb-4">
              <h3 class="mb-1 text-base font-semibold text-red-400 sm:text-lg">Résumé</h3>
              <p class="text-sm text-gray-300 sm:text-base">{show.overview}</p>
            </div>
          {/if}

          {#if show.missing_episode_count > 0 && show.seasons && show.seasons.some(season => season.missing_episode_count > 0 && season.monitored && !season.has_future_episodes)}
            <button
              class="mt-3 w-full rounded-lg bg-gradient-to-r from-red-500 to-emerald-500 py-2 text-sm font-medium sm:mt-4"
              on:click={() => handleSeasonIt(null)}
            >
              🧂 Season It pour toute la Série !
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Seasons -->
    <div class="mt-6 sm:mt-8">
      <h3 class="mb-3 text-lg font-bold sm:mb-4 sm:text-xl">Saisons</h3>

      {#each (show.seasons || []).filter(s => s.seasonNumber > 0) as season (season.seasonNumber)}
        <div class="mb-2 overflow-hidden rounded-lg bg-gray-800">
          <!-- Header -->
          <div
            class="flex cursor-pointer flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
            on:click={() => toggleSeason(season.seasonNumber)}
          >
            <div class="flex items-center gap-2">
              <span class="text-sm">{expandedSeasons.has(season.seasonNumber) ? '▼' : '▶'}</span>
              <h4 class="text-base font-semibold sm:text-lg">Saison {season.seasonNumber}</h4>
            </div>

            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
              <span class="text-xs sm:text-sm">{season.episodeCount} épisodes</span>

              {#if season.missing_episode_count > 0}
                <span class="text-xs text-red-500 sm:text-sm">{season.missing_episode_count} manquants</span>
              {:else}
                <span class="text-xs text-emerald-500 sm:text-sm">Complète</span>
              {/if}

              {#if !season.monitored}
                <span class="text-xs text-gray-400 sm:text-sm">Non surveillée</span>
              {/if}

              {#if season.missing_episode_count > 0 && season.monitored && !season.has_future_episodes}
                <div class="flex w-full gap-2 sm:w-auto">
                  <button
                    class="flex-1 rounded bg-gradient-to-r from-red-500 to-emerald-500 px-2 py-1 text-xs sm:flex-none sm:text-sm"
                    on:click|stopPropagation={() => handleSeasonIt(season.seasonNumber)}
                  >
                    🧂 Season It !
                  </button>
                  <button
                    class="flex-1 rounded bg-gray-700 px-2 py-1 text-xs sm:flex-none sm:text-sm"
                    on:click|stopPropagation={() => handleInteractiveSearch(season.seasonNumber)}
                  >
                    🔍 Rechercher
                  </button>
                </div>
              {/if}

              {#if season.has_future_episodes}
                <span class="text-xs text-amber-500 sm:text-sm">⏳ Saison incomplète</span>
              {/if}
            </div>
          </div>

          <!-- Episodes -->
          {#if expandedSeasons.has(season.seasonNumber)}
            <div class="bg-gray-900 px-3 py-2 sm:px-4">
              {#each (season.episodes || []).slice().sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)) as episode (episode.id)}
                <div class="flex flex-col gap-1 border-b border-gray-700 py-2 last:border-none sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div class="text-sm font-semibold">
                      {episode.episodeNumber} - {episode.title || `Épisode ${episode.episodeNumber}`}
                    </div>
                    {#if episode.airDate}
                      <div class="text-xs text-gray-400">{formatDate(episode.airDate)}</div>
                    {/if}
                  </div>
                  <div class={`text-sm font-semibold ${getEpisodeStatusColor(getEpisodeStatus(episode))}`}>
                    {getEpisodeStatus(episode)}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if user}
      <div class="mt-6">
        <EnhancedProgressBar userId={user.id} />
      </div>
    {/if}

    {#if searchModalOpen}
      <SearchResultsModal
        show={show}
        seasonNumber={searchModalSeason}
        instanceId={instanceId}
        onClose={handleCloseSearchModal}
      />
    {/if}
  </div>
{/if}
