<script lang="ts">
  import { onMount } from 'svelte';
  import { sonarr } from '$lib/api';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { browser } from '$app/environment';

  // Instances + sélection
  let instances: Array<{ id: number; name?: string }> = [];
  let selectedId: number | null = null;
  let selectedInstance: { id: number; name?: string } | null = null;

  // Activités + pagination
  let activities: any[] = [];
  let loading = false;
  let page = 1;
  let hasMore = true;
  let mobileMenuOpen = false;

  // Helpers
  const formatDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const statusIcon = (st: string) =>
    st === 'success' ? '✅' : st === 'error' ? '❌' : st === 'in_progress' ? '⏳' : '📝';
  const statusBorder = (st: string) =>
    st === 'success' ? 'border-emerald-500' : st === 'error' ? 'border-rose-500' : st === 'in_progress' ? 'border-amber-500' : 'border-slate-500';
  const statusBadge = (st: string) =>
    st === 'success' ? 'bg-emerald-500' : st === 'error' ? 'bg-rose-500' : st === 'in_progress' ? 'bg-amber-500' : 'bg-slate-500';

  // Chargement des instances + sélection initiale
  onMount(async () => {
    try {
      const r = await sonarr.getInstances();
      instances = r?.data ?? [];

      const stored =
        sessionStorage.getItem('selectedInstanceId') ||
        sessionStorage.getItem('seasonarr_selected_instance') ||
        localStorage.getItem('seasonarr_selected_instance');

      const fromStorage = stored && !isNaN(Number(stored)) ? Number(stored) : null;
      const initialId =
        fromStorage && instances.some(i => i.id === fromStorage)
          ? fromStorage
          : (instances[0]?.id ?? null);

      if (initialId) {
        setSelected(initialId, false);
        await loadActivities(1);
      }
    } catch (e) {
      console.error('Erreur lors du chargement de la liste des instances :', e);
    }
  });

  function setSelected(id: number, persist = true) {
    selectedId = id;
    selectedInstance = instances.find(i => i.id === id) || (id ? { id } : null);
    if (persist) {
      sessionStorage.setItem('selectedInstanceId', String(id));
      sessionStorage.setItem('seasonarr_selected_instance', String(id));
      localStorage.setItem('seasonarr_selected_instance', String(id));
    }
  }

  async function onInstanceChange(e: Event) {
    const val = Number((e.target as HTMLSelectElement).value);
    if (!val) return;
    setSelected(val, true);
    activities = [];
    hasMore = true;
    await loadActivities(1);
  }

  async function loadActivities(pageNum = 1) {
    if (!selectedInstance) return;
    loading = true;
    try {
      const r = await sonarr.getActivityLogs(selectedInstance.id, pageNum, 10);
      const list = r?.data ?? [];
      activities = pageNum === 1 ? list : [...activities, ...list];
      hasMore = list.length === 10;
      page = pageNum;
    } catch (e) {
      console.error('Erreur lors du chargement des activités :', e);
    } finally {
      loading = false;
    }
  }

  function loadMore() {
    if (!loading && hasMore) loadActivities(page + 1);
  }
</script>

<div class="min-h-screen bg-[#0f131a] text-gray-100">
  <!-- top bar -->
  <header class="sticky top-0 z-20 border-b border-white/5 bg-[#0f131a]/80 backdrop-blur">
    <div class="mx-auto max-w-7xl px-4">
      <div class="flex h-16 items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center gap-3">
          <div class="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-rose-500 to-amber-400 shadow">
            <svg viewBox="0 0 24 24" class="h-5 w-5 text-white">
              <path fill="currentColor" d="M12 2s5 3.5 5 8.5S15 20 12 22c-3-2-5-5-5-9.5S12 2 12 2z"/>
            </svg>
          </div>
          <div class="text-2xl font-semibold tracking-wide">
            <span class="text-white">Season</span><span class="text-cyan-400">arr</span>
          </div>
        </div>

        <!-- Actions desktop -->
        <div class="hidden md:flex items-center gap-3">
          <div class="relative">
            <select
              class="appearance-none rounded-md bg-[#1a2230] px-3 py-2 pr-9 text-sm text-gray-200 outline-none ring-1 ring-white/10 hover:ring-white/20"
              bind:value={selectedId}
              on:change={onInstanceChange}
              disabled={!instances.length}
            >
              {#if !instances.length}
                <option value="">Aucune instance</option>
              {:else}
                {#each instances as inst}
                  <option value={inst.id}>{inst.name || `Sonarr #${inst.id}`}</option>
                {/each}
              {/if}
            </select>
            <svg class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
            </svg>
          </div>
          <button class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" on:click={() => goto(`${base}/settings`)}>
            Paramètres
          </button>
          <button class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" on:click={() => goto(`${base}/dashboard`)}>
            Tableau de bord
          </button>
          <button
            class="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded text-sm"
            on:click={() => { auth.logout?.(); if (browser) localStorage.removeItem('token'); location.reload(); }}
          >
            Déconnexion
          </button>
        </div>

        <!-- Hamburger mobile -->
        <div class="md:hidden">
          <button
            on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
            class="inline-flex items-center justify-center rounded-md p-2 text-gray-300 hover:bg-[#2a3344] focus:outline-none"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {#if !mobileMenuOpen}
              <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            {:else}
              <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Menu mobile -->
    {#if mobileMenuOpen}
      <div id="mobile-menu" class="md:hidden border-t border-white/10">
        <div class="space-y-2 px-4 pb-4 pt-2">
          <div class="relative">
            <select
              class="w-full appearance-none rounded-md bg-[#1a2230] px-3 py-2 pr-9 text-sm text-gray-200 outline-none ring-1 ring-white/10 hover:ring-white/20"
              bind:value={selectedId}
              on:change={onInstanceChange}
              disabled={!instances.length}
            >
              {#if !instances.length}
                <option value="">Aucune instance</option>
              {:else}
                {#each instances as inst}
                  <option value={inst.id}>{inst.name || `Sonarr #${inst.id}`}</option>
                {/each}
              {/if}
            </select>
            <svg class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
            </svg>
          </div>
          <button class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" on:click={() => goto(`${base}/settings`)}>
            Paramètres
          </button>
          <button class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" on:click={() => goto(`${base}/dashboard`)}>
            Tableau de bord
          </button>
          <button
            class="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded text-sm"
            on:click={() => { auth.logout?.(); if (browser) localStorage.removeItem('token'); location.reload(); }}
          >
            Déconnexion
          </button>
        </div>
      </div>
    {/if}
  </header>

  <main class="mx-auto max-w-7xl px-4 pb-12">
    <div class="h-px w-full bg-white/5"></div>
    <h2 class="mt-10 text-2xl font-semibold text-white">Historique des activités</h2>

    {#if !selectedInstance && instances.length === 0}
      <div class="py-12 text-center text-gray-400">Aucune instance Sonarr configurée.</div>
    {:else if !selectedInstance}
      <div class="py-12 text-center text-gray-400">Sélectionnez une instance Sonarr pour voir l’historique.</div>
    {:else if loading && activities.length === 0}
      <div class="flex flex-col items-center py-10">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-white/40"></div>
        <p class="mt-3 text-gray-300">Chargement des activités…</p>
      </div>
    {:else if activities.length === 0}
      <div class="py-16 text-center">
        <div class="mb-2 text-5xl">📋</div>
        <h3 class="text-lg font-medium text-white">Aucune activité récente</h3>
        <p class="text-gray-400">Les activités apparaîtront ici lorsque vous utiliserez la fonction « Season It! ».</p>
      </div>
    {:else}
      <section class="mt-6 space-y-5">
        {#each activities as a (a.id)}
          <article
            class={`group relative overflow-hidden rounded-xl bg-[#1c1816] p-4 md:p-5 shadow-sm ring-1 ring-white/10 border-l-4 ${statusBorder(a.status)}
                    transition-transform duration-200 hover:-translate-y-1 hover:ring-2 hover:ring-green-500`}
          >
            <div class="flex items-start gap-4">
              <div class="text-2xl leading-none">{statusIcon(a.status)}</div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="truncate font-semibold text-white">{a.show_title}</h4>
                    {#if a.season_number}
                      <span class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-200 ring-1 ring-white/10">
                        Saison {a.season_number}
                      </span>
                    {/if}
                  </div>
                  <div class="shrink-0 text-sm text-gray-300">{formatDate(a.created_at)}</div>
                </div>

                <p class="mt-1 text-sm text-gray-200">{a.message}</p>

                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <span class={`rounded px-2 py-0.5 text-[11px] font-semibold text-white ${statusBadge(a.status)}`}>
                    {a.status.toUpperCase()}
                  </span>
                  {#if a.completed_at}
                    <span class="text-xs text-gray-400">Terminé : {formatDate(a.completed_at)}</span>
                  {/if}
                </div>

                {#if a.error_details}
                  <div class="mt-3 flex items-start gap-2 rounded-md bg-rose-500/10 p-2 ring-1 ring-rose-500/20">
                    <div>⚠️</div>
                    <div class="text-sm text-rose-200">
                      <strong class="mr-1">Détails de l’erreur :</strong>{a.error_details}
                    </div>
                  </div>
                {/if}
              </div>

              {#if a.status === 'success'}
                <div class="ml-2 mt-1 shrink-0">
                  <svg class="h-7 w-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" class="opacity-40"/>
                    <path d="M8 12.5l2.5 2.5L16 9" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              {/if}
            </div>
          </article>
        {/each}

        {#if hasMore}
          <div class="flex justify-center pt-2">
            <button
              on:click={loadMore}
              disabled={loading}
              class="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm text-gray-100 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-60"
            >
              {#if loading}
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60"></div>
                <span>Chargement…</span>
              {:else}
                <span>Charger plus d’activités ↓</span>
              {/if}
            </button>
          </div>
        {/if}
      </section>
    {/if}
  </main>
</div>
