<script lang="ts">
  export let items: any[] = [];
  export let loading: boolean = false;

  // petite aide pour formater la date/heure
  function fmtDateTime(v: string | number | Date) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  }

  // style du badge de statut (on garde les valeurs de statut telles quelles)
  function statusClass(s: string) {
    const k = (s || '').toLowerCase();
    if (k.includes('queued')) return 'bg-sky-600/20 text-sky-300 border-sky-700/40';
    if (k.includes('processing')) return 'bg-amber-600/20 text-amber-300 border-amber-700/40';
    if (k.includes('completed') || k.includes('success')) return 'bg-emerald-600/20 text-emerald-300 border-emerald-700/40';
    if (k.includes('failed') || k.includes('error')) return 'bg-rose-600/20 text-rose-300 border-rose-700/40';
    return 'bg-gray-600/20 text-gray-300 border-gray-700/40';
    }
</script>

<div class="rounded-xl border border-gray-800 overflow-hidden">
  <div class="bg-[var(--card)] px-4 py-3 border-b border-gray-800 flex items-center justify-between">
    <h3 class="text-sm font-semibold opacity-80">Historique</h3>
    {#if loading}<span class="text-xs opacity-70">Mise à jour…</span>{/if}
  </div>

  {#if loading && items.length === 0}
    <div class="p-4 text-sm opacity-80">Chargement…</div>
  {:else if items.length === 0}
    <div class="p-4 text-sm opacity-70">Aucune activité trouvée.</div>
  {:else}
    <ul class="divide-y divide-gray-800">
      {#each items as it (it.id || `${it.timestamp}-${it.title}-${it.type}`)}
        <li class="px-4 py-3 flex items-start gap-3">
          <div class="w-10 h-10 rounded bg-gray-900 border border-gray-800 flex items-center justify-center shrink-0">
            <span class="text-xs opacity-80">{(it.type || 'evt').slice(0,3).toUpperCase()}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold truncate">
                  {it.title || it.show_title || it.name || 'Événement'}
                </div>
                <div class="text-xs opacity-70 truncate">
                  {it.subtitle || it.message || it.indexer || it.source || ''}
                </div>
              </div>
              {#if it.status}
                <span class={`text-[10px] px-1.5 py-0.5 rounded border ${statusClass(it.status)}`}>
                  {it.status}
                </span>
              {/if}
            </div>

            <div class="mt-1 flex items-center gap-2 text-xs opacity-70">
              {#if it.timestamp || it.date}
                <span>{fmtDateTime(it.timestamp || it.date)}</span>
              {/if}
              {#if it.season != null && it.episode != null}
                <span>• S{it.season}E{it.episode}</span>
              {/if}
              {#if it.size}
                <span>• {Math.round((it.size / (1024**3)) * 10) / 10} Go</span>
              {/if}
            </div>

            {#if typeof it.progress === 'number'}
              <div class="mt-2 h-2 bg-gray-900 rounded overflow-hidden border border-gray-800">
                <div class="h-full bg-emerald-600" style={`width:${Math.max(0, Math.min(100, it.progress))}%`}/>
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
