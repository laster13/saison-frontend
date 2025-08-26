<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { sonarr } from '$lib/api';

  let showId = '';
  let seasonNumber: number | null = null;
  let instanceId: number | null = null;
  let releases = writable([]);
  let bulkInput = '';
  let bulkResults = writable([]);
  let activityLogs = writable([]);
  let progress = writable({ message: '', percent: 0, status: 'idle', details: {} });
  let ws: WebSocket;

  const connectWebSocket = () => {
    ws = new WebSocket(`ws://localhost:8000/ws/${123}`); // Remplacer 123 par l'user_id réel
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'progress_update') {
        progress.set({ message: msg.message, percent: msg.percent, status: msg.status, details: msg.details });
      } else if (msg.type === 'clear_progress') {
        progress.set({ message: '', percent: 0, status: 'idle', details: {} });
      }
    };
  };

  onMount(() => connectWebSocket());

  const fetchReleases = async () => {
    try {
      progress.set({ message: 'Recherche de releases...', percent: 10, status: 'loading', details: {} });
      const res = await sonarr.searchSeasonPacks(showId, seasonNumber, instanceId);
      releases.set(res.data);
      progress.set({ message: 'Releases trouvées.', percent: 100, status: 'success', details: {} });
    } catch (err) {
      progress.set({ message: 'Erreur de recherche.', percent: 100, status: 'error', details: err });
    }
  };

  const launchSeasonIt = async () => {
    try {
      progress.set({ message: 'Lancement de Season It...', percent: 5, status: 'processing', details: {} });
      const res = await sonarr.seasonIt(showId, seasonNumber, instanceId);
      progress.set({ message: res.data.message, percent: 100, status: res.data.status, details: res.data });
    } catch (err) {
      progress.set({ message: 'Erreur Season It.', percent: 100, status: 'error', details: err });
    }
  };

  const downloadRelease = async (guid: string, indexerId: number) => {
    try {
      progress.set({ message: 'Téléchargement en cours...', percent: 50, status: 'downloading', details: {} });
      const res = await sonarr.downloadRelease(guid, showId, seasonNumber, instanceId, indexerId);
      progress.set({ message: res.data.message, percent: 100, status: res.data.status, details: res.data });
    } catch (err) {
      progress.set({ message: 'Erreur de téléchargement.', percent: 100, status: 'error', details: err });
    }
  };

  const launchBulk = async () => {
    try {
      const items = bulkInput.split('\n').map(line => {
        const [id, name, season] = line.split(',');
        return { id: parseInt(id), name: name?.trim(), season_number: season ? parseInt(season) : null };
      });
      const res = await sonarr.bulkSeasonIt(items);
      bulkResults.set(res.data.results || []);
    } catch (err) {
      console.error('Erreur bulk:', err);
    }
  };

  const loadActivityLogs = async () => {
    try {
      const res = await sonarr.getActivityLogs(instanceId);
      activityLogs.set(res.data);
    } catch (err) {
      console.error('Erreur chargement logs:', err);
    }
  };
</script>

<style>
  .card { padding: 1rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 8px; }
  .progress { height: 1rem; background: #eee; border-radius: 4px; overflow: hidden; margin-top: 1rem; }
  .progress-bar { height: 100%; transition: width 0.3s; background-color: #0a74da; }
</style>

<h1>🎬 Season It - Interface complète</h1>

<div class="card">
  <label>Show ID <input bind:value={showId} /></label>
  <label>Season Number <input type="number" bind:value={seasonNumber} /></label>
  <label>Instance ID <input type="number" bind:value={instanceId} /></label>
  <button on:click={launchSeasonIt}>Lancer Season It</button>
  <button on:click={fetchReleases}>🔍 Rechercher les season packs</button>
</div>

<div class="card">
  <h3>🟢 Progression</h3>
  <div class="progress">
    <div class="progress-bar" style="width: {$progress.percent}%"></div>
  </div>
  <p>{$progress.message}</p>
</div>

{#each $releases as release}
  <div class="card">
    <strong>{release.title}</strong> - {release.size_formatted} - {release.quality} ({release.seeders} seeders)
    <button on:click={() => downloadRelease(release.guid, release.indexer_id)}>⬇️ Télécharger</button>
  </div>
{/each}

<div class="card">
  <h3>📦 Bulk Season It</h3>
  <p>Format : `id,name,season` par ligne (saison optionnelle)</p>
  <textarea rows="5" bind:value={bulkInput} placeholder="123,My Show,1\n456,Another Show"></textarea>
  <button on:click={launchBulk}>Lancer le Bulk</button>
  <ul>
    {#each $bulkResults as result}
      <li>{result.show_title} ({result.status})</li>
    {/each}
  </ul>
</div>

<div class="card">
  <h3>📝 Historique des Activités</h3>
  <button on:click={loadActivityLogs}>🔄 Recharger les logs</button>
  <ul>
    {#each $activityLogs as log}
      <li>[{log.status}] {log.show_title} - S{log.season_number} - {log.message}</li>
    {/each}
  </ul>
</div>
