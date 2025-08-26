<script lang="ts">
  import { onMount } from 'svelte';
  import { sonarr } from '$lib/api';

  let instances: any[] = [];
  let loading = true;
  let editingInstance: any = null;
  let testingConnection: string | number | null = null;
  let message = '';
  let messageType: 'info' | 'success' | 'error' = 'info';
  let deleteConfirm: any = null;

  onMount(loadInstances);

  async function loadInstances() {
    try {
      const response = await sonarr.getInstances();
      instances = response.data;
    } catch (e) {
      console.error('Error loading instances:', e);
      message = 'Error loading Sonarr instances';
      messageType = 'error';
    } finally {
      loading = false;
    }
  }

  function handleEdit(instance: any) {
    editingInstance = {
      id: instance.id,
      name: instance.name,
      url: instance.url,
      api_key: '',
      originalInstance: instance
    };
    message = '';
    messageType = 'info';
  }

  async function handleTestConnection(i: any) {
    if (!i.name?.trim() || !i.url?.trim() || !i.api_key?.trim()) {
      message = 'Name, URL, and API key are required for testing';
      messageType = 'error';
      return;
    }
    testingConnection = i.id || 'editing';
    message = '';
    try {
      const r = await sonarr.testConnection({ name: i.name, url: i.url, api_key: i.api_key });
      const ok = r?.data?.success;
      message = ok ? 'Connection successful!' : 'Connection failed';
      messageType = ok ? 'success' : 'error';
    } catch (e) {
      console.error('testConnection error:', e);
      message = 'Connection test failed';
      messageType = 'error';
    } finally {
      testingConnection = null;
      setTimeout(() => { message = ''; messageType = 'info'; }, 5000);
    }
  }

  async function handleTestExistingConnection(instance: any) {
    testingConnection = instance.id;
    message = '';
    try {
      const r = await sonarr.testExistingConnection(instance.id);
      const ok = r?.data?.success;
      message = ok ? 'Connection successful!' : 'Connection failed';
      messageType = ok ? 'success' : 'error';
    } catch (e) {
      console.error('testExistingConnection error:', e);
      message = 'Connection test failed';
      messageType = 'error';
    } finally {
      testingConnection = null;
      setTimeout(() => { message = ''; messageType = 'info'; }, 5000);
    }
  }

  function handleCancelEdit() {
    editingInstance = null;
    message = '';
    messageType = 'info';
  }

  async function handleSaveEdit() {
    if (!editingInstance?.name?.trim() || !editingInstance?.url?.trim()) {
      message = 'Name and URL are required';
      messageType = 'error';
      return;
    }
    try {
      const data: any = { name: editingInstance.name, url: editingInstance.url };
      if (editingInstance.api_key?.trim()) data.api_key = editingInstance.api_key;

      await sonarr.updateInstance(editingInstance.id, data);
      message = 'Instance updated successfully!';
      messageType = 'success';
      editingInstance = null;
      loadInstances();
      setTimeout(() => { message = ''; messageType = 'info'; }, 3000);
    } catch (e: any) {
      console.error('updateInstance error:', e);
      message = e?.response?.data?.detail || 'Error updating instance';
      messageType = 'error';
    }
  }

  function handleDelete(instance: any) {
    deleteConfirm = instance;
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await sonarr.deleteInstance(deleteConfirm.id);
      message = 'Instance deleted successfully!';
      messageType = 'success';
      loadInstances();
      setTimeout(() => { message = ''; messageType = 'info'; }, 3000);
    } catch (e) {
      console.error('deleteInstance error:', e);
      message = 'Error deleting instance';
      messageType = 'error';
    } finally {
      deleteConfirm = null;
    }
  }

  function cancelDelete() {
    deleteConfirm = null;
  }
</script>

{#if loading}
  <div class="text-gray-400">Chargement des instances Sonarr...</div>
{:else}
  <div class="space-y-6">

    {#if message}
      <div
        class="rounded-md px-3 py-2 text-sm"
        class:bg-emerald-600={messageType === 'success'}
        class:bg-rose-600={messageType === 'error'}
        class:bg-gray-700={messageType === 'info'}
      >
        {message}
      </div>
    {/if}

    {#if instances.length === 0}
      <p class="text-gray-300">Aucune instance Sonarr configurée.</p>
    {:else}
      {#each instances as instance (instance.id)}
        <div class="rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-lg transition-all hover:-translate-y-1 hover:border-emerald-500">
          
          {#if editingInstance?.id === instance.id}
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-gray-300">Nom :</label>
                <input
                  class="mt-1 w-full rounded-md bg-gray-800 px-3 py-2 text-sm text-gray-100 ring-1 ring-white/10 focus:outline-none"
                  type="text"
                  bind:value={editingInstance.name}
                />
              </div>
              <div>
                <label class="block text-sm text-gray-300">URL :</label>
                <input
                  class="mt-1 w-full rounded-md bg-gray-800 px-3 py-2 text-sm text-gray-100 ring-1 ring-white/10 focus:outline-none"
                  type="url"
                  bind:value={editingInstance.url}
                />
              </div>
              <div>
                <label class="block text-sm text-gray-300">
                  Clé API : <span class="text-xs text-gray-400">(laisser vide pour conserver l’actuelle)</span>
                </label>
                <input
                  class="mt-1 w-full rounded-md bg-gray-800 px-3 py-2 text-sm text-gray-100 ring-1 ring-white/10 focus:outline-none"
                  type="password"
                  placeholder="Nouvelle clé API ou vide"
                  bind:value={editingInstance.api_key}
                />
              </div>

              <div class="flex flex-col sm:flex-row flex-wrap gap-2">
                <button class="w-full sm:w-auto rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500" on:click={handleSaveEdit}>
                  Sauvegarder
                </button>
                <button
                  class="w-full sm:w-auto rounded-md bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
                  on:click={() => handleTestConnection(editingInstance)}
                  disabled={testingConnection === 'editing'}
                >
                  {testingConnection === 'editing' ? 'Test en cours...' : 'Tester la connexion'}
                </button>
                <button class="w-full sm:w-auto rounded-md bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-500" on:click={handleCancelEdit}>
                  Annuler
                </button>
              </div>
            </div>
          
          {:else}
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-white">{instance.name}</h3>
                <div class="mt-3 space-y-1 text-sm">
                  <p>
                    <span class="font-semibold text-gray-300">URL :</span> 
                    <span class="ml-2 text-gray-200 break-all">{instance.url}</span>
                  </p>
                  <p>
                    <span class="font-semibold text-gray-300">Créé le :</span> 
                    <span class="ml-2 text-gray-200">{new Date(instance.created_at).toLocaleDateString()}</span>
                  </p>
                  <p>
                    <span class="font-semibold text-gray-300">Statut :</span>
                    <span class="ml-2 rounded-md px-2 py-0.5 text-xs text-white {instance.is_active ? 'bg-emerald-700/80' : 'bg-rose-700/80'}">
                      {instance.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </p>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
                <button class="w-full sm:w-auto rounded-md bg-gradient-to-r from-rose-500 to-emerald-600 px-3 py-2 text-sm font-semibold text-white" on:click={() => handleEdit(instance)}>
                  Modifier
                </button>
                <button class="w-full sm:w-auto rounded-md bg-gray-700 px-3 py-2 text-sm text-white ring-1 ring-white/10 hover:bg-gray-600" on:click={() => handleTestExistingConnection(instance)}>
                  {testingConnection === instance.id ? 'Test en cours...' : 'Tester la connexion'}
                </button>
                <button class="w-full sm:w-auto rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500" on:click={() => handleDelete(instance)}>
                  Supprimer
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}

    {#if deleteConfirm}
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-xl bg-gray-900 p-6 ring-1 ring-white/10">
          <h3 class="mb-3 text-xl font-semibold text-white">Supprimer l’instance</h3>
          <p class="text-gray-300">Voulez-vous vraiment supprimer l’instance Sonarr :</p>
          <p class="mt-1 font-semibold text-white">{deleteConfirm.name}</p>
          <div class="mt-5 flex flex-col sm:flex-row justify-end gap-3">
            <button class="w-full sm:w-auto rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold hover:bg-rose-500" on:click={confirmDelete}>
              Supprimer
            </button>
            <button class="w-full sm:w-auto rounded-md bg-gray-700 px-4 py-2 text-sm text-white ring-1 ring-white/10 hover:bg-gray-600" on:click={cancelDelete}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    {/if}

  </div>
{/if}
