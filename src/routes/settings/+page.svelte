<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { settings } from '$lib/api';
  import logoTransparent from '$lib/assets/logotransparent.png';
  import SonarrInstanceManager from '$lib/components/SonarrInstanceManager.svelte';

  let userSettings = {
    disable_season_pack_check: false,
    require_deletion_confirmation: false,
    skip_episode_deletion: false,
    shows_per_page: 36,
    default_sort: 'title_asc',
    default_show_missing_only: true
  };

  let loading = true;
  let saving = false;
  let message = '';
  let showPurgeConfirm = false;
  let purging = false;

  onMount(loadSettings);

  async function loadSettings() {
    try {
      userSettings = (await settings.getSettings()).data;
    } catch (e) {
      console.error('Erreur chargement paramètres:', e);
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    message = '';
    try {
      await settings.updateSettings(userSettings);
      message = 'Paramètres enregistrés avec succès !';
      setTimeout(() => (message = ''), 3000);
    } catch (e) {
      console.error('Erreur enregistrement paramètres:', e);
      message = 'Erreur lors de l’enregistrement des paramètres';
    } finally {
      saving = false;
    }
  }

  async function handlePurgeDatabase() {
    purging = true;
    message = '';
    try {
      await settings.purgeDatabase();
      message = 'Base de données purgée avec succès. Toutes vos données ont été réinitialisées.';
      showPurgeConfirm = false;
      await loadSettings();
      setTimeout(() => goto(`${base}/dashboard`), 2000);
    } catch (e) {
      console.error('Erreur purge BDD:', e);
      message = 'Erreur lors de la purge de la base de données. Veuillez réessayer.';
    } finally {
      purging = false;
    }
  }

  // options des switches (FR)
  const seasonPackOptions = [
    {
      key: 'disable_season_pack_check',
      title: 'Désactiver la vérification d’éligibilité',
      desc: 'Ignorer la vérification des packs de saison disponibles lors de l’action « Season It! »'
    },
    {
      key: 'require_deletion_confirmation',
      title: 'Exiger une confirmation avant suppression',
      desc: 'Afficher une confirmation avant de supprimer des épisodes existants'
    },
    {
      key: 'skip_episode_deletion',
      title: 'Ne pas supprimer les épisodes existants',
      desc: 'Télécharger les packs de saison sans supprimer au préalable les épisodes individuels'
    }
  ];
</script>

{#if loading}
  <div class="min-h-screen grid place-items-center bg-[#0f131a] text-gray-200 px-4">
    Chargement des paramètres...
  </div>
{:else}
  <div class="min-h-screen bg-[#0f131a] text-gray-100">
    <!-- Header -->
    <div class="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-4 sm:pt-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3 sm:gap-4">
          <img src={logoTransparent} alt="Seasonarr" class="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
          <h1 class="text-3xl sm:text-5xl font-extrabold tracking-wide text-white">Paramètres</h1>
        </div>
        <button
          class="w-full sm:w-auto rounded-md bg-[#222a33] px-3 py-2 text-sm text-gray-200 ring-1 ring-white/10 hover:bg-[#283240]"
          on:click={() => goto(`${base}/dashboard`)}
        >
          ← Retour au tableau de bord
        </button>
      </div>
    </div>

    <main class="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 sm:pb-16 space-y-6">
      <!-- Instances Sonarr -->
      <section class="rounded-2xl border border-white/10 bg-[#12161d] p-4 sm:p-6 shadow-lg">
        <h2 class="text-xl sm:text-2xl font-semibold text-[#cf6157]">Instances Sonarr</h2>
        <p class="mt-2 text-sm text-gray-300">Gérez vos connexions aux serveurs Sonarr</p>

        <div class="mt-4 sm:mt-5 rounded-xl border border-white/10 bg-[#1a1f27] p-3 sm:p-4 overflow-x-auto">
          <SonarrInstanceManager />
        </div>
      </section>

      <!-- Traitement des packs de saison -->
      <section class="rounded-2xl border border-white/10 bg-[#12161d] p-4 sm:p-6 shadow-lg">
        <h2 class="text-xl sm:text-2xl font-semibold text-[#cf6157]">Traitement des packs de saison</h2>

        <div class="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-[#1a1f27]">
          {#each seasonPackOptions as item}
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3">
              <div class="pr-0 sm:pr-4">
                <p class="font-semibold text-gray-100">{item.title}</p>
                <p class="text-sm text-gray-400">{item.desc}</p>
              </div>

              <!-- Switch compact (glisse) -->
              <label class="relative inline-flex items-center self-end sm:self-center">
                <input type="checkbox" class="peer sr-only" bind:checked={userSettings[item.key]} />
                <!-- rail -->
                <span class="block h-5 w-9 rounded-full bg-gray-600 transition-colors duration-300
                            peer-checked:bg-emerald-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-400/70"></span>
                <!-- knob -->
                <span class="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow
                            transition-transform duration-300 peer-checked:translate-x-[16px]"></span>
              </label>
            </div>
          {/each}
        </div>
      </section>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          class="w-full sm:w-auto rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          on:click={saveSettings}
          disabled={saving}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </button>
        {#if message}
          <div
            class="w-full sm:w-auto rounded-md px-3 py-2 text-sm text-center"
            class:!bg-emerald-600={message.includes('succès')}
            class:!bg-rose-600={!message.includes('succès')}
          >
            {message}
          </div>
        {/if}
      </div>

      <!-- Zone dangereuse -->
      <section class="rounded-2xl border border-white/10 bg-[#12161d] p-4 sm:p-6">
        <h2 class="text-xl sm:text-2xl font-semibold text-[#cf6157]">Zone dangereuse</h2>
        <div class="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1a1f27] p-3 sm:p-4">
          <div class="max-w-full sm:max-w-[70ch]">
            <p class="font-semibold text-gray-100">Réinitialisation complète (Purge de la base de données)</p>
            <p class="text-sm text-gray-400">Supprime définitivement toutes vos données : instances Sonarr, paramètres, notifications et historiques d’activité. Cette action est irréversible.</p>
          </div>
          <button
            class="w-full sm:w-auto rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold hover:bg-rose-500 disabled:opacity-60"
            on:click={() => (showPurgeConfirm = true)}
            disabled={purging}
          >
            {purging ? 'Purge en cours...' : 'Purger la base de données'}
          </button>
        </div>
      </section>
    </main>

    <!-- Modale confirmation purge -->
    {#if showPurgeConfirm}
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
        <div class="w-full max-w-lg rounded-xl bg-[#12161d] p-6 ring-1 ring-white/10">
          <h3 class="text-lg sm:text-xl font-semibold text-white">Confirmer la réinitialisation complète</h3>
          <p class="mt-2 text-gray-300">Voulez-vous vraiment purger toutes vos données ?</p>
          <p class="mt-2 text-sm"><strong>Cette action supprimera définitivement :</strong></p>
          <ul class="ml-5 list-disc text-sm text-gray-300">
            <li>Toutes les instances Sonarr</li>
            <li>Tous les paramètres et préférences</li>
            <li>Toutes les notifications</li>
            <li>Tous les journaux d’activité</li>
          </ul>
          <p class="mt-3 font-medium text-rose-400">Cette action ne peut pas être annulée !</p>
          <div class="mt-5 flex flex-col sm:flex-row justify-end gap-3">
            <button
              class="w-full sm:w-auto rounded-md bg-[#222a33] px-4 py-2 text-sm text-gray-200 ring-1 ring-white/10 hover:bg-[#283240]"
              on:click={() => (showPurgeConfirm = false)}
              disabled={purging}
            >
              Annuler
            </button>
            <button
              class="w-full sm:w-auto rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold hover:bg-rose-500 disabled:opacity-60"
              on:click={handlePurgeDatabase}
              disabled={purging}
            >
              {purging ? 'Purge en cours...' : 'Oui, purger la base'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
