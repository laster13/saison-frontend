<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import api from '$lib/api';

  export let isOpen: boolean = false;
  export let instanceId: number;
  export let showId: number;
  export let seasonNumber: number;
  export let onClose: () => void;

  const dispatch = createEventDispatcher<{
    openSearch: { seasonNumber: number };
  }>();

  let loading = false;
  let error: string | null = null;
  let episodes: any[] = [];

  // Rechargement quand le modal s’ouvre
  onMount(() => {
    if (isOpen) loadEpisodes();
  });
  $: if (isOpen) {
    // (ré)ouvre → recharge
    loadEpisodes();
  }

  async function loadEpisodes() {
    if (!instanceId || !showId || !seasonNumber) return;
    loading = true;
    error = null;
    episodes = [];
    try {
      // Essaie d’abord un endpoint "saisons détaillées"
      // Adapte selon ton backend. Deux variantes courantes :
      //  1) /shows/:id/seasons/:season_number
      //  2) /shows/:id?include=episodes&season=...
      let r;

      try {
        r = await api.get(`/shows/${showId}/seasons/${seasonNumber}`, {
          params: { instance_id: instanceId }
        });
        // format attendu: { episodes: [...] } OU directement [...]
        const data = r?.data;
        episodes = Array.isArray(data) ? data : (data?.episodes || []);
      } catch {
        // fallback générique
        r = await api.get(`/shows/${showId}`, {
          params: { instance_id: instanceId, season: seasonNumber, include: 'episodes' }
        });
        const s = r?.data?.seasons?.find(
          (x: any) =>
            (x.season_number ?? x.seasonNumber ?? x.number) === seasonNumber
        );
        episodes = s?.episodes || [];
      }
    } catch (e: any) {
      console.error(e);
      error = e?.message || 'Échec du chargement des épisodes.';
    } finally {
      loading = false;
    }
  }

  function fmtDate(input: any): string | null {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    const locale = browser ? (navigator.language || 'fr-FR') : 'fr-FR';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  }

  function onBackdropClick(e: MouseEvent) {
    // fermer si clic en dehors du contenu
    if (e.target && (e.target as HTMLElement).dataset?.backdrop === '1') {
      onClose?.();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose?.();
  }

  function openSeasonSearch() {
    dispatch('openSearch', { seasonNumber });
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    data-backdrop="1"
    on:click={onBackdropClick}
  >
    <div class="w-[min(96vw,900px)] max-h-[90vh] overflow-hidden bg-[var(--card)] rounded-xl border border-gray-800 shadow-xl">
      <!-- En-tête -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div class="flex items-center gap-3">
          <h4 class="text-lg font-semibold">Épisodes — Saison {seasonNumber}</h4>
          <button
            class="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-800"
            on:click={loadEpisodes}
            title="Rafraîchir la liste des épisodes"
          >
            Rafraîchir
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-800"
            on:click={openSeasonSearch}
            title="Rechercher des releases pour cette saison"
          >
            Rechercher (saison)
          </button>
          <button
            class="px-2 py-1 border border-gray-700 rounded hover:bg-gray-800"
            on:click={onClose}
            aria-label="Fermer"
            title="Fermer la fenêtre"
          >✕</button>
        </div>
      </div>

      <!-- Corps -->
      <div class="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
        {#if loading}
          <p>Chargement des épisodes…</p>
        {:else if error}
          <p class="text-red-400">{error}</p>
        {:else if episodes.length === 0}
          <p class="opacity-70">Aucun épisode trouvé pour cette saison.</p>
        {:else}
          <ul class="divide-y divide-gray-800">
            {#each episodes as ep (
                ep.id ??
                `${ep.season_number ?? ep.seasonNumber ?? seasonNumber}-${
                    ep.episode_number ?? ep.episodeNumber ?? ep.number ?? ''
                }`
            )}
              <li class="py-3 flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="text-sm font-semibold truncate">
                    S{ep.season_number ?? ep.seasonNumber ?? seasonNumber}
                    E{ep.episode_number ?? ep.episodeNumber ?? ep.number ?? '??'} — {ep.title || 'Épisode'}
                  </div>
                  <div class="text-xs opacity-70 flex flex-wrap gap-2">
                    {#if ep.airDate || ep.air_date || ep.firstAired}
                      <span>Diffusion : {fmtDate(ep.airDate || ep.air_date || ep.firstAired)}</span>
                    {/if}
                    {#if ep.runtime}
                      <span>• {ep.runtime} min</span>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class={`text-[11px] px-1.5 py-0.5 rounded border
                    ${(ep.hasFile || ep.downloaded || ep.status === 'downloaded')
                      ? 'border-emerald-700/40 bg-emerald-600/20 text-emerald-300'
                      : 'border-amber-700/40 bg-amber-600/20 text-amber-300'}`}>
                    {(ep.hasFile || ep.downloaded) ? 'téléchargé' : 'manquant'}
                  </span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
{/if}
