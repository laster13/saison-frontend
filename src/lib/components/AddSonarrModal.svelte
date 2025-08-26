<script lang="ts">
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { sonarr } from '$lib/api';

  export let isOpen: boolean = false;
  export let onClose: () => void = () => {};
  export let onSuccess: () => void = () => {};

  let name = '';
  let url = '';
  let api_key = '';

  let loading = false;
  let error = '';
  let testingConnection = false;
  let testResult: { success: boolean; message: string } | null = null;

  let clearTimer: any = null;

  // 🔹 Fonction pour forcer HTTPS en production
  function sanitizeUrl(inputUrl: string) {
    if (import.meta.env.PROD) {
      return inputUrl.replace(/^http:\/\//, 'https://');
    }
    return inputUrl;
  }

  function resetForm() {
    name = '';
    url = '';
    api_key = '';
    error = '';
    testResult = null;
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
  }

  function autoClearTestResult() {
    if (!browser) return;
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      testResult = null;
      clearTimer = null;
    }, 5000);
  }

  async function handleTestConnection() {
    if (!url.trim() || !api_key.trim()) {
      error = 'URL and API key are required for testing';
      return;
    }
    error = '';
    testResult = null;
    testingConnection = true;

    try {
      const resp = await sonarr.testConnection({
        name: name?.trim() || 'Test Instance',
        url: sanitizeUrl(url.trim()),
        api_key: api_key.trim()
      });

      if (resp?.data?.success) {
        testResult = { success: true, message: 'Connection successful!' };
      } else {
        testResult = { success: false, message: 'Connection failed' };
      }
    } catch (e) {
      console.error('Error testing connection:', e);
      testResult = { success: false, message: 'Connection test failed' };
    } finally {
      testingConnection = false;
      autoClearTestResult();
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await sonarr.createInstance({
        name: name.trim(),
        url: sanitizeUrl(url.trim()),
        api_key: api_key.trim()
      });

      onSuccess?.();
      onClose?.();
      resetForm();
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Failed to add Sonarr instance';
      error = detail;
    } finally {
      loading = false;
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') onClose?.();
  }

  onDestroy(() => {
    if (clearTimer) clearTimeout(clearTimer);
  });
</script>

<svelte:window on:keydown={onKeyDown} />

{#if isOpen}
  <!-- Overlay -->
  <div
    class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    on:click={() => onClose?.()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-sonarr-title"
  >
    <!-- Contenu modal -->
    <div
      class="w-full max-w-md rounded-xl border border-gray-700 bg-[var(--card)] shadow-xl"
      on:click|stopPropagation
    >
      <!-- En-tête -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 id="add-sonarr-title" class="text-lg font-semibold">Ajouter une instance Sonarr</h2>
        <button
          class="h-8 w-8 grid place-items-center rounded hover:bg-gray-700"
          on:click={() => onClose?.()}
          aria-label="Fermer la fenêtre"
        >
          ×
        </button>
      </div>

      <!-- Formulaire -->
      <form class="px-4 py-4 space-y-4" on:submit|preventDefault={handleSubmit}>
        <!-- Nom -->
        <div class="flex flex-col gap-1">
          <label class="text-sm opacity-80">Nom</label>
          <input
            class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            type="text"
            placeholder="ex. Sonarr principal"
            bind:value={name}
            required
          />
        </div>

        <!-- URL -->
        <div class="flex flex-col gap-1">
          <label class="text-sm opacity-80">URL</label>
          <input
            class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            type="url"
            placeholder="https://sonarr.domain.fr"
            bind:value={url}
            required
          />
        </div>

        <!-- Clé API -->
        <div class="flex flex-col gap-1">
          <label class="text-sm opacity-80">Clé API</label>
          <input
            class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            type="text"
            placeholder="Votre clé API Sonarr"
            bind:value={api_key}
            required
          />
        </div>

        <!-- Erreur -->
        {#if error}
          <div class="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded px-3 py-2">
            {error}
          </div>
        {/if}

        <!-- Résultat du test (effacement auto 5s) -->
        {#if testResult}
          <div class={`text-sm rounded px-3 py-2 border
            ${testResult.success
              ? 'text-emerald-300 bg-emerald-900/20 border-emerald-700'
              : 'text-red-300 bg-red-900/20 border-red-700'}`}>
            {testResult.message}
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-3 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            on:click={() => onClose?.()}
            disabled={loading || testingConnection}
          >
            Annuler
          </button>

          <button
            type="button"
            class="px-3 py-2 text-sm rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50"
            on:click={handleTestConnection}
            disabled={loading || testingConnection}
          >
            {testingConnection ? 'Test en cours...' : 'Tester la connexion'}
          </button>

          <button
            type="submit"
            class="px-3 py-2 text-sm rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50"
            disabled={loading || testingConnection}
          >
            {loading ? 'Ajout en cours...' : 'Ajouter l’instance'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
