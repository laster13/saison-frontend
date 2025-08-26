<script lang="ts">
  import { onMount } from 'svelte';
  import { writable, get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { sonarr, auth, settings } from '$lib/api';
  import api from '$lib/api';

  import ShowCard from '$lib/components/ShowCard.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import SkeletonCard from '$lib/components/SkeletonCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import AddSonarrModal from '$lib/components/AddSonarrModal.svelte';
  import EnhancedProgressBar from '$lib/components/EnhancedProgressBar.svelte';
  import SonarrSelector from '$lib/components/SonarrSelector.svelte';
  import { connectWebSocket } from '$lib/stores/websocket';


  // Stores
  const instances = writable<any[]>([]);
  const selectedInstance = writable<any | null>(null);
  const shows = writable<any[]>([]);
  const loading = writable<boolean>(false);
  const user = writable<any | null>(null);
  const stats = writable({
    totalShows: 0,
    totalMissingEpisodes: 0,
    showsWithMissingEpisodes: 0,
    seasonsWithMissingEpisodes: 0
  });
  const userSettings = writable({
    shows_per_page: 35,
    default_sort: 'title_asc',
    default_show_missing_only: true
  });
  const filterOptions = writable({
    networks: [],
    genres: [],
    certifications: [],
    year_range: { min: null, max: null },
    runtime_range: { min: null, max: null }
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL_HTTPS;

  // État local
  let showAddModal = false;
  let selectedId: number | null = null;
  let isMobileMenuOpen = false;
  let headerEl: HTMLElement | null = null;

  // Filtres et pagination
  let showAdvancedFilters = false;
  let page = browser ? parseInt(localStorage.getItem('seasonarr_current_page') || '1', 10) : 1;
  let totalPages = 1;
  let totalItems = 0;

  let search = '';
  let status: '' | 'continuing' | 'ended' | 'upcoming' | 'any' = '';
  let missing_episodes: boolean | undefined = true;
  let sort: 'title_asc' | 'title_desc' | 'year_desc' | 'year_asc' | 'status' | 'missing_desc' | 'missing_asc' = 'title_asc';
  let network = '';
  let genres: string[] = [];
  let year_from: number | '' = '';
  let year_to: number | '' = '';
  let runtime_min: number | '' = '';
  let runtime_max: number | '' = '';
  let certification = '';

  // Bulk
  let bulkMode = false;
  let selectedShows = new Set<number>();

  // Dérivés
  $: pageSize = get(userSettings).shows_per_page || 35;
  $: eligibleShows = $shows.filter((s) => (s?.missing_episode_count || 0) > 0);
  let missingStr = '';
  $: missingStr = missing_episodes === undefined ? '' : (missing_episodes ? 'true' : 'false');

  // --- LIFECYCLE ---
  onMount(async () => {
    if (browser) {
      try {
        const savedAdv = localStorage.getItem('seasonarr_show_advanced_filters');
        if (savedAdv) showAdvancedFilters = JSON.parse(savedAdv);
      } catch {}
    }

    const onDocClick = (e: MouseEvent) => {
      if (!isMobileMenuOpen) return;
      if (headerEl && !headerEl.contains(e.target as Node)) {
        isMobileMenuOpen = false;
      }
    };
    document.addEventListener('click', onDocClick);

    await loadUser();
    await loadSettings();
    await loadInstances();

    return () => document.removeEventListener('click', onDocClick);
  });

  // --- LOADERS ---
  async function loadUser() {
    try {
      const r = await auth.getMe();
      user.set(r); // pas r.data !
    } catch (err) {
      console.error("Erreur loadUser:", err);
    }
  }

  async function loadSettings() {
    try {
      const r = await settings.getSettings();
      userSettings.set(r.data);
      const saved = browser ? localStorage.getItem('seasonarr_filters') : null;
      if (saved) {
        applySavedFilters(JSON.parse(saved));
      } else {
        const def = {
          search: '',
          status: '',
          missing_episodes: r.data.default_show_missing_only,
          sort: r.data.default_sort,
          network: '',
          genres: [],
          year_from: '',
          year_to: '',
          runtime_min: '',
          runtime_max: '',
          certification: ''
        };
        applySavedFilters(def);
        if (browser) localStorage.setItem('seasonarr_filters', JSON.stringify(def));
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }

  async function loadInstances() {
    try {
      const r = await sonarr.getInstances();
      const list = r.data || [];
      instances.set(list);

      const savedId = browser ? localStorage.getItem('seasonarr_selected_instance') : null;
      const fromSaved = savedId ? list.find((i: any) => i.id === parseInt(savedId, 10)) : null;
      const inst = fromSaved || list[0];

      if (inst) {
        selectedInstance.set(inst);
        selectedId = inst.id;
        await Promise.all([
          loadFilterOptions(inst.id),
          loadShows(inst.id),
          loadStats(inst.id)
        ]);
      }
    } catch (e) {
      console.error('Error loading instances:', e);
    }
  }

  async function loadFilterOptions(instanceId: number) {
    try {
      const r = await sonarr.getFilterOptions(instanceId);
      filterOptions.set(r.data || get(filterOptions));
    } catch (e) {
      console.error('Error loading filter options:', e);
    }
  }

  async function loadShows(instanceId: number) {
    if (!instanceId) return;
    loading.set(true);
    try {
      const params: Record<string, any> = { instance_id: instanceId, page, page_size: pageSize };
      if (search) params.search = search;
      if (status && status !== 'any') params.show_status = status;
      if (typeof missing_episodes === 'boolean') params.missing_episodes = missing_episodes;
      if (sort) params.sort = sort;
      if (network) params.network = network;
      if (genres.length) params.genres = genres.join(',');
      if (year_from !== '') params.year_from = year_from;
      if (year_to !== '') params.year_to = year_to;
      if (runtime_min !== '') params.runtime_min = runtime_min;
      if (runtime_max !== '') params.runtime_max = runtime_max;
      if (certification) params.certification = certification;

      const r = await api.get('/shows', { params });
      const raw = r?.data?.shows || [];
      const list = raw.map((s: any) => {
        const seed = s?.id || s?.title || Math.random();
        const poster = s?.poster_url || `https://picsum.photos/seed/${encodeURIComponent(seed)}/300/450`;
        return { ...s, poster, poster_url: s?.poster_url || poster };
      });

      shows.set(sortShows(list, sort));

      const apiTotalPages = r?.data?.total_pages ?? null;
      const apiTotal = r?.data?.total ?? r?.data?.total_items ?? null;
      const fallbackTotal = list.length;

      if (apiTotal != null) {
        totalItems = apiTotal;
        totalPages = apiTotalPages ?? Math.max(1, Math.ceil(apiTotal / pageSize));
      } else if (apiTotalPages) {
        totalPages = apiTotalPages;
        totalItems = apiTotalPages * pageSize;
      } else {
        totalItems = fallbackTotal;
        totalPages = Math.max(1, Math.ceil(fallbackTotal / pageSize));
      }
    } catch (e) {
      console.error('Error loading shows:', e);
    } finally {
      loading.set(false);
    }
  }

  async function loadStats(instanceId: number) {
    try {
      const r = await sonarr.getShows(instanceId, 1, 10000, {});
      const data = r?.data?.shows || [];
      const seasonsWithMissingEpisodes = data.reduce(
        (acc: number, show: any) =>
          acc +
          (show.seasons?.filter((s: any) => s.monitored && (s.missing_episode_count || 0) > 0).length ||
            0),
        0
      );
      const showsWithMissing = data.filter((s: any) => (s.missing_episode_count || 0) > 0).length;
      stats.set({
        totalShows: data.length,
        totalMissingEpisodes: data.reduce((sum: number, s: any) => sum + (s.missing_episode_count || 0), 0),
        showsWithMissingEpisodes: showsWithMissing,
        seasonsWithMissingEpisodes
      });
    } catch (e) {
      console.error('Error loading statistics:', e);
    }
  }

  // --- HELPERS & HANDLERS ---
  function applySavedFilters(f: any) {
    const rawStatus = f.status ?? '';
    status = rawStatus === 'any' ? '' : rawStatus;
    search = f.search ?? '';
    missing_episodes = typeof f.missing_episodes === 'boolean' ? f.missing_episodes : undefined;
    sort = f.sort ?? 'title_asc';
    network = f.network ?? '';
    genres = Array.isArray(f.genres) ? f.genres : [];
    year_from = f.year_from ?? '';
    year_to = f.year_to ?? '';
    runtime_min = f.runtime_min ?? '';
    runtime_max = f.runtime_max ?? '';
    certification = f.certification ?? '';
  }

  function sortShows(list: any[], opt: typeof sort) {
    const s = [...list];
    switch (opt) {
      case 'title_asc': return s.sort((a, b) => a.title.localeCompare(b.title));
      case 'title_desc': return s.sort((a, b) => b.title.localeCompare(a.title));
      case 'year_desc': return s.sort((a, b) => (b.year || 0) - (a.year || 0));
      case 'year_asc': return s.sort((a, b) => (a.year || 0) - (b.year || 0));
      case 'status': return s.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
      case 'missing_desc': return s.sort((a, b) => (b.missing_episode_count || 0) - (a.missing_episode_count || 0));
      case 'missing_asc': return s.sort((a, b) => (a.missing_episode_count || 0) - (b.missing_episode_count || 0));
      default: return s;
    }
  }

  function persistFiltersAndPage() {
    if (!browser) return;
    const f = { search, status, missing_episodes, sort, network, genres, year_from, year_to, runtime_min, runtime_max, certification };
    localStorage.setItem('seasonarr_filters', JSON.stringify(f));
    localStorage.setItem('seasonarr_current_page', String(page));
  }

  function onSearchInput(e: Event) {
    search = (e.target as HTMLInputElement).value;
    page = 1;
    persistFiltersAndPage();
    if (get(selectedInstance)) loadShows(get(selectedInstance)!.id);
  }

  function onBasicFilterChange() {
    page = 1;
    persistFiltersAndPage();
    if (get(selectedInstance)) loadShows(get(selectedInstance)!.id);
  }

  async function handleInstanceChange() {
    const inst = get(instances).find((i) => i.id === Number(selectedId));
    if (!inst) return;
    selectedInstance.set(inst);
    page = 1;
    if (browser) {
      localStorage.setItem('seasonarr_selected_instance', String(inst.id));
      localStorage.setItem('seasonarr_current_page', '1');
    }
    await Promise.all([loadFilterOptions(inst.id), loadShows(inst.id), loadStats(inst.id)]);
  }

  function toggleAdvanced() {
    isMobileMenuOpen = false;
    showAdvancedFilters = !showAdvancedFilters;
    if (browser) localStorage.setItem('seasonarr_show_advanced_filters', JSON.stringify(showAdvancedFilters));
  }

  function resetAllFilters() {
    const us = get(userSettings);
    search = '';
    status = '';
    missing_episodes = us.default_show_missing_only;
    sort = us.default_sort;
    network = '';
    genres = [];
    year_from = '';
    year_to = '';
    runtime_min = '';
    runtime_max = '';
    certification = '';
    page = 1;
    persistFiltersAndPage();
    if (get(selectedInstance)) loadShows(get(selectedInstance)!.id);
  }

  function changePage(p: number) {
    const pages = Math.max(1, totalPages);
    if (p < 1 || p > pages) return;
    page = p;
    if (browser) localStorage.setItem('seasonarr_current_page', String(p));
    if (get(selectedInstance)) loadShows(get(selectedInstance)!.id);
  }

  function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
  }

  // Bulk helpers
  function toggleBulkMode() {
    bulkMode = !bulkMode;
    if (!bulkMode) selectedShows = new Set();
  }
  function enterBulkMode() { bulkMode = true; }
  function handleSelectionChange(e: CustomEvent<{ showId: number }>) {
    const showId = e.detail.showId;
    const next = new Set(selectedShows);
    if (next.has(showId)) next.delete(showId); else next.add(showId);
    selectedShows = next;
    if (selectedShows.size === 0 && bulkMode) bulkMode = false;
  }

  async function handleSelectAll() {
    const currentPageIds = new Set($shows.map((s) => s.id));
    const hasAllCurrentSelected = [...currentPageIds].every((id) => selectedShows.has(id));
    if (hasAllCurrentSelected && selectedShows.size > $shows.length) {
      selectedShows = new Set(); bulkMode = false; return;
    }
    if (hasAllCurrentSelected) {
      try {
        const inst = get(selectedInstance); if (!inst) return;
        const r = await api.get('/shows', { params: { instance_id: inst.id, page: 1, page_size: 10000 } });
        const all = (r?.data?.shows || []).filter((s: any) => (s?.missing_episode_count || 0) > 0);
        selectedShows = new Set(all.map((s: any) => s.id));
      } catch (e) {
        console.error('Error loading all shows for selection:', e);
        selectedShows = new Set($shows.map((s) => s.id));
      }
      return;
    }
    selectedShows = new Set($shows.map((s) => s.id));
  }

function onMissingChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  missing_episodes = v === '' ? undefined : v === 'true';
  onBasicFilterChange();
}

  async function handleBulkSeasonIt() {
    if (selectedShows.size === 0) return;
    try {
      const us = await settings.getSettings();
      const requireConfirmation = us.data.require_deletion_confirmation;
      const skipDeletion = us.data.skip_episode_deletion;
      if (requireConfirmation && !skipDeletion) {
        const selectedOnPage = $shows.filter((s) => selectedShows.has(s.id));
        const titles = selectedOnPage.map((s) => s.title).join(', ');
        if (!window.confirm(`Supprimer les épisodes existants de ${selectedShows.size} série(s) (${titles}) ?`)) return;
      }
      const inst = get(selectedInstance); if (!inst) return;
      const items = Array.from(selectedShows).map((id) => {
        const s = $shows.find((x) => x.id === id);
        return { id, name: s?.title ?? `Show ${id}`, season_number: null, poster_url: s?.poster_url || null, instance_id: inst.id };
      });
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bulk-season-it`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: browser ? `Bearer ${localStorage.getItem('token') || ''}` : '' },
        body: JSON.stringify({ show_items: items })
      });
      if (!resp.ok) throw new Error(`Bulk Season It failed: ${resp.statusText}`);
      selectedShows = new Set(); bulkMode = false;
    } catch (e: any) {
      console.error('Bulk Season It failed:', e);
      alert(`Bulk Season It failed: ${e.message || e}`);
    }
  }

  // Bulk select label
  $: selectAllLabel = (() => {
    const setPageIds = new Set($shows.map((s) => s.id));
    const hasAll = [...setPageIds].every((id) => selectedShows.has(id));
    if (hasAll && selectedShows.size > $shows.length) return 'Deselect All';
    if (hasAll) return 'Select All Pages';
    return 'Select Page';
  })();
</script>

<!-- HEADER -->
<header bind:this={headerEl} class="dashboard-header">
  <nav class="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[var(--card)]">
     <!-- Logo -->
<!-- Logo cliquable -->
<button
  class="flex items-center gap-3 group focus:outline-none"
  on:click={() => (window.location.href = `${backendUrl}/settings/symlinks`)}
>
  <div class="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-rose-500 to-amber-400 shadow group-hover:scale-105 transition">
    <svg viewBox="0 0 24 24" class="h-5 w-5 text-white">
      <path
        fill="currentColor"
        d="M12 2s5 3.5 5 8.5S15 20 12 22c-3-2-5-5-5-9.5S12 2 12 2z"
      />
    </svg>
  </div>
  <div class="text-2xl font-semibold tracking-wide">
    <span class="text-white">Season</span><span class="text-cyan-400">arr</span>
  </div>
</button>

    <!-- Desktop controls -->
    <div class="hidden md:flex items-center gap-2">
      <!-- Sonarr selector (desktop) -->
      <SonarrSelector
        instances={$instances}
        bind:selectedId
        on:change={() => handleInstanceChange()}
        label="Instance Sonarr"
        placeholder="Sélectionner une instance"
      />

      <button
        class="bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded text-sm"
        on:click={() => (showAddModal = true)}
      >
        + Ajouter une instance
      </button>
      <button class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" on:click={() => goto(`${base}/settings`)}>
        Paramètres
      </button>
      <button
        class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm"
        on:click={() => (window.location.href = `${backendUrl}/settings/symlinks`)}
      >
        Symlinks
      </button>      <button class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" on:click={() => goto(`${base}/activity`)}>
        Activité
      </button>
      <button
        class="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded text-sm"
        on:click={() => { auth.logout?.(); if (browser) localStorage.removeItem('token'); location.reload(); }}
      >
        Déconnexion
      </button>
    </div>

    <!-- Hamburger (mobile) -->
    <button
      class="md:hidden p-2 rounded border border-gray-700"
      aria-label="Basculer le menu mobile"
      aria-expanded={isMobileMenuOpen}
      on:click={toggleMobileMenu}
    >
      <span class="block w-5 h-0.5 mb-1 bg-gray-300"></span>
      <span class="block w-5 h-0.5 mb-1 bg-gray-300"></span>
      <span class="block w-5 h-0.5 bg-gray-300"></span>
    </button>
  </nav>

  {#if isMobileMenuOpen}
    <div class="md:hidden px-6 py-3 border-b border-gray-800 bg-[var(--card)] flex flex-col gap-2">

      <!-- Sonarr selector (mobile) -->
      <SonarrSelector
        instances={$instances}
        bind:selectedId
        on:change={() => { handleInstanceChange(); isMobileMenuOpen = false; }}
        label="Instance Sonarr (mobile)"
        placeholder="Sélectionner une instance"
      />

      <button
        class="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded text-sm"
        on:click={() => { showAddModal = true; isMobileMenuOpen = false; }}
      >
        + Ajouter une instance
      </button>

      <!-- Symlinks -->
      <button
        class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm"
        on:click={() => { goto('/settings/symlinks'); isMobileMenuOpen = false; }}
      >
        Symlinks
      </button>

      <button
        class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm"
        on:click={() => { goto(`${base}/settings`); isMobileMenuOpen = false; }}
      >
        Paramètres
      </button>

      <button
        class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm"
        on:click={() => { goto(`${base}/activity`); isMobileMenuOpen = false; }}
      >
        Activité
      </button>

      <button
        class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
        on:click={() => {
          auth.logout?.();
          if (browser) localStorage.removeItem('token');
          location.reload();
        }}
      >
        Déconnexion
      </button>
    </div>
  {/if}
</header>

{#if $selectedInstance}
  <main class="container-hero py-6">
    <h2 class="text-lg font-semibold text-teal-400 mb-4">Aperçu de la bibliothèque</h2>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="SÉRIES TOTALES" value={$stats.totalShows} />
      <StatCard label="ÉPISODES MANQUANTS" value={$stats.totalMissingEpisodes} />
      <StatCard label="SÉRIES AVEC ÉPISODES MANQUANTS" value={$stats.showsWithMissingEpisodes} />
      <StatCard label="SAISONS AVEC ÉPISODES MANQUANTS" value={$stats.seasonsWithMissingEpisodes} />
    </div>

    <div class="mt-6 card">
      <div class="px-4 py-4">
        <input aria-label="Rechercher des séries" placeholder="Rechercher des séries..." class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" on:input={onSearchInput} value={search} />

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <label class="sr-only" for="statusSelect">Statut</label>
          <select id="statusSelect" class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" bind:value={status} on:change={onBasicFilterChange}>
            <option value=''>Tous les statuts</option>
            <option value="continuing">En cours</option>
            <option value="ended">Terminé</option>
            <option value="upcoming">À venir</option>
          </select>

          <label class="sr-only" for="missingSelect">Manquants</label>
          <select id="missingSelect" class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" bind:value={missingStr} on:change={onMissingChange}>
            <option value=''>Toutes les séries</option>
            <option value="true">Épisodes manquants</option>
            <option value="false">Complète</option>
          </select>

          <label class="sr-only" for="sortSelect">Trier</label>
          <select id="sortSelect" class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" bind:value={sort} on:change={onBasicFilterChange}>
            <option value="title_asc">Titre (A-Z)</option>
            <option value="title_desc">Titre (Z-A)</option>
            <option value="year_desc">Année (récent)</option>
            <option value="year_asc">Année (ancien)</option>
            <option value="status">Statut</option>
            <option value="missing_desc">Épisodes manquants (plus)</option>
            <option value="missing_asc">Épisodes manquants (moins)</option>
          </select>

          <button class="bg-red-700 hover:bg-red-600 px-3 py-2 rounded text-sm" on:click={resetAllFilters}>Réinitialiser les filtres</button>
          <button class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm" on:click={toggleAdvanced} class:!bg-teal-700={showAdvancedFilters} aria-pressed={showAdvancedFilters}>
            {showAdvancedFilters ? 'Masquer avancés' : 'Filtres avancés'}
          </button>
          <button class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm" on:click={toggleBulkMode} class:!bg-teal-700={bulkMode} aria-pressed={bulkMode}>
            {bulkMode ? 'Quitter sélection multiple' : 'Sélection multiple'}
          </button>
        </div>

        {#if showAdvancedFilters}
          <div class="mt-4 grid gap-4">
            <div class="grid md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-sm opacity-80" for="networkSelect">Chaîne</label>
                <select id="networkSelect" class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" bind:value={network} on:change={onBasicFilterChange}>
                  <option value=''>Toutes les chaînes</option>
                  {#each $filterOptions.networks as net}
                    <option value={net}>{net}</option>
                  {/each}
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm opacity-80" for="certSelect">Classification</label>
                <select id="certSelect" class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" bind:value={certification} on:change={onBasicFilterChange}>
                  <option value=''>Toutes les classifications</option>
                  {#each $filterOptions.certifications as cert}
                    <option value={cert}>{cert}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="grid md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-sm opacity-80" for="yearFrom">Plage d'années</label>
                <div class="flex items-center gap-2">
                  <input id="yearFrom" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="De"
                    min={$filterOptions.year_range.min ?? undefined} max={$filterOptions.year_range.max ?? undefined} value={year_from}
                    on:input={(e) => { const v = (e.target as HTMLInputElement).value; year_from = v ? parseInt(v, 10) : ''; }}
                    on:change={onBasicFilterChange} />
                  <span>à</span>
                  <input id="yearTo" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="À"
                    min={$filterOptions.year_range.min ?? undefined} max={$filterOptions.year_range.max ?? undefined} value={year_to}
                    on:input={(e) => { const v = (e.target as HTMLInputElement).value; year_to = v ? parseInt(v, 10) : ''; }}
                    on:change={onBasicFilterChange} />
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm opacity-80" for="runtimeMin">Durée (minutes)</label>
                <div class="flex items-center gap-2">
                  <input id="runtimeMin" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="Min"
                    min={$filterOptions.runtime_range.min ?? undefined} max={$filterOptions.runtime_range.max ?? undefined} value={runtime_min}
                    on:input={(e) => { const v = (e.target as HTMLInputElement).value; runtime_min = v ? parseInt(v, 10) : ''; }}
                    on:change={onBasicFilterChange} />
                  <span>à</span>
                  <input id="runtimeMax" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="Max"
                    min={$filterOptions.runtime_range.min ?? undefined} max={$filterOptions.runtime_range.max ?? undefined} value={runtime_max}
                    on:input={(e) => { const v = (e.target as HTMLInputElement).value; runtime_max = v ? parseInt(v, 10) : ''; }}
                    on:change={onBasicFilterChange} />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm opacity-80">Genres</span>
              <div class="flex flex-wrap gap-3">
                {#each $filterOptions.genres as g, i}
                  <label class="inline-flex items-center gap-2 text-sm" for={`genre-${i}`}>
                    <input id={`genre-${i}`} type="checkbox" checked={genres.includes(g)}
                      on:change={(e) => { const checked = (e.target as HTMLInputElement).checked; genres = checked ? [...genres, g] : genres.filter((x) => x !== g); onBasicFilterChange(); }} />
                    <span>{g}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <!-- PAGINATION (TOP) -->
        <div class="mt-4">
          <Pagination {page} totalItems={totalItems} pageSize={pageSize} on:changePage={(e) => changePage(e.detail)} />
        </div>
      </div>
    </div>

    <!-- BULK ACTIONS BAR -->
    {#if bulkMode && eligibleShows.length > 0}
      <div class="mt-4 flex items-center justify-between gap-3 bg-gray-800/60 border border-gray-700 rounded p-3">
        <div class="flex items-center gap-3">
          <span class="text-sm">
            {selectedShows.size} sélectionné(s)
            {selectedShows.size > $shows.length ? ' (toutes les pages)' : ` sur ${eligibleShows.length} dans cette page`}
          </span>
          <button class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" on:click={handleSelectAll}>{selectAllLabel}</button>
        </div>
        <button class="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded text-sm disabled:opacity-50" on:click={handleBulkSeasonIt} disabled={selectedShows.size === 0}>
          🧂 Lancer Season It ! ({selectedShows.size})
        </button>
      </div>
    {/if}

    <!-- GRID -->
    <div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
      {#if $loading}
        {#each Array(12) as _}<SkeletonCard />{/each}
      {:else}
        {#each $shows as show (show.id)}
          <ShowCard {show} instanceId={$selectedInstance?.id} isSelected={selectedShows.has(show.id)} {bulkMode}
            on:selectionChange={handleSelectionChange} on:enterBulkMode={enterBulkMode} />
        {/each}
      {/if}
    </div>

    <!-- PAGINATION (BOTTOM) -->
    <div class="mt-6">
      <Pagination
        {page}
        totalItems={totalItems}
        pageSize={pageSize}
        on:changePage={(e) => changePage(e.detail)}
      />
    </div>

    <!-- ✅ Toujours monté, comme en React -->
    <EnhancedProgressBar userId={$user?.id || null} />
  </main>
{/if}

<AddSonarrModal
  isOpen={showAddModal}
  onClose={() => (showAddModal = false)}
  onSuccess={() => {
    showAddModal = false;
    loadInstances();
  }}
/>